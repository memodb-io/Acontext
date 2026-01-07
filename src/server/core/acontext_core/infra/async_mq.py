# NOTE: MQ connection may be closed after long idle time or during startup instability.
# The publish() method includes retry logic to handle reconnection automatically.
import os
import asyncio
import json
import traceback
from enum import StrEnum
from functools import partial
from pydantic import ValidationError, BaseModel
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Any, Dict, Optional, List, Set, Tuple
from time import perf_counter

from aio_pika import connect_robust, ExchangeType, Message
from aio_pika.exceptions import ChannelInvalidStateError
from aio_pika.abc import AbstractConnection, AbstractChannel, AbstractQueue

from ..env import LOG, DEFAULT_CORE_CONFIG
from ..telemetry.log import bound_logging_vars
from ..util.handler_spec import check_handler_function_sanity, get_handler_body_type

# Optional OpenTelemetry imports - only used when tracing is enabled
from opentelemetry import trace, propagate, context as otel_context
from opentelemetry.trace import Status, StatusCode

OTEL_AVAILABLE = True


class SpecialHandler(StrEnum):
    NO_PROCESS = "no_process"


LOGGING_FIELDS = {"project_id", "session_id"}


def _is_otel_enabled() -> bool:
    """Check if OpenTelemetry tracing is enabled"""
    try:
        from ..telemetry.config import TelemetryConfig

        config = TelemetryConfig.from_env()
        return config.enabled
    except Exception:
        # Fallback to environment variable check if config loading fails
        return bool(os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))


def _extract_trace_context_from_headers(message: Message) -> Optional[Any]:
    """
    Extract trace context from message headers for trace propagation.

    Returns:
        Extracted trace context or None if extraction fails
    """
    if not _is_otel_enabled() or not message.headers or not OTEL_AVAILABLE:
        return None

    try:
        # Convert headers to string dict for propagation
        headers = {}
        for k, v in message.headers.items():
            # aio_pika headers values can be various types
            if isinstance(v, (str, bytes)):
                headers[k] = (
                    v if isinstance(v, str) else v.decode("utf-8", errors="ignore")
                )
            else:
                headers[k] = str(v)

        if headers:
            return propagate.extract(headers)
    except Exception:
        pass  # If extraction fails, return None

    return None


def _create_consume_span(
    config: "ConsumerConfig",
    message: Message,
    extracted_context: Optional[Any] = None,
) -> Tuple[Optional[Any], Optional[Any]]:
    """
    Create a span for message consumption.

    Returns:
        Tuple of (span, context) or (None, None) if tracing is disabled
    """
    if not _is_otel_enabled() or not OTEL_AVAILABLE:
        return None, None

    try:
        tracer = trace.get_tracer(__name__)
        span_context = extracted_context if extracted_context else None
        consume_span = tracer.start_span(
            "mq.consume",
            kind=trace.SpanKind.CONSUMER,
            context=span_context,
        )
        consume_span.set_attribute("messaging.system", "rabbitmq")
        consume_span.set_attribute("messaging.destination", config.queue_name)
        consume_span.set_attribute("messaging.destination_kind", "queue")
        consume_span.set_attribute("messaging.rabbitmq.exchange", config.exchange_name)
        consume_span.set_attribute("messaging.rabbitmq.routing_key", config.routing_key)

        consume_context = trace.set_span_in_context(consume_span)
        return consume_span, consume_context
    except Exception:
        return None, None


def _create_process_span(
    config: "ConsumerConfig",
    message: Message,
    parent_context: Optional[Any] = None,
) -> Tuple[Optional[Any], Optional[Any]]:
    """
    Create a span for message processing.

    Returns:
        Tuple of (span, context) or (None, None) if tracing is disabled
    """
    if not _is_otel_enabled() or not OTEL_AVAILABLE:
        return None, None

    try:
        message_id = getattr(message, "message_id", None)
        if message_id:
            message_id = str(message_id)

        tracer = trace.get_tracer(__name__)
        span = tracer.start_span(
            "mq.process",
            kind=trace.SpanKind.CONSUMER,
            context=parent_context,
        )
        span.set_attribute("messaging.system", "rabbitmq")
        span.set_attribute("messaging.destination", config.queue_name)
        span.set_attribute("messaging.destination_kind", "queue")
        if message_id:
            span.set_attribute("messaging.message_id", message_id)

        process_context = trace.set_span_in_context(span)
        return span, process_context
    except Exception:
        return None, None


def _create_publish_span_and_headers(
    exchange_name: str,
    routing_key: str,
    body: str,
) -> Tuple[Optional[Any], Dict[str, Any]]:
    """
    Create a span for message publishing and inject trace context into headers.

    Returns:
        Tuple of (span, headers_dict)
    """
    headers = {}
    span = None

    if not _is_otel_enabled() or not OTEL_AVAILABLE:
        return None, headers

    try:
        from ..telemetry.otel import create_mq_publish_span

        span = create_mq_publish_span(exchange_name, routing_key)
        span.set_attribute(
            "messaging.message_payload_size_bytes", len(body.encode("utf-8"))
        )

        # Inject trace context into message headers for trace propagation
        ctx = trace.set_span_in_context(span)
        propagate.inject(headers, context=ctx)
    except Exception:
        pass  # If tracing fails, continue without it

    return span, headers


def _set_span_status(
    span: Optional[Any], status_code: Any, description: Optional[str] = None
) -> None:
    """Set status on a span if it exists"""
    if span and OTEL_AVAILABLE:
        try:
            span.set_status(Status(status_code, description))
        except Exception:
            pass


def _record_span_exception(span: Optional[Any], exception: Exception) -> None:
    """Record an exception on a span if it exists"""
    if span:
        try:
            span.record_exception(exception)
        except Exception:
            pass


@dataclass
class ConsumerConfigData:
    """Configuration for a single consumer"""

    exchange_name: str
    routing_key: str
    queue_name: str
    exchange_type: ExchangeType = ExchangeType.DIRECT
    durable: bool = True
    auto_delete: bool = False
    # Configuration
    prefetch_count: int = DEFAULT_CORE_CONFIG.mq_global_qos
    message_ttl_seconds: int = DEFAULT_CORE_CONFIG.mq_default_message_ttl_seconds
    timeout: float = DEFAULT_CORE_CONFIG.mq_consumer_handler_timeout
    max_retries: int = DEFAULT_CORE_CONFIG.mq_default_max_retries
    retry_delay: float = DEFAULT_CORE_CONFIG.mq_default_retry_delay_unit_sec
    # DLX setup
    need_dlx_queue: bool = False
    dlx_ttl_days: int = DEFAULT_CORE_CONFIG.mq_default_dlx_ttl_days
    use_dlx_ex_rk: Optional[tuple[str, str]] = None
    dlx_suffix: str = "dead"


@dataclass
class ConsumerConfig(ConsumerConfigData):
    """Configuration for a single consumer"""

    handler: Optional[
        Callable[[BaseModel, Message], Awaitable[Any]] | SpecialHandler
    ] = field(default=None)
    body_pydantic_type: Optional[BaseModel] = field(default=None)

    def __post_init__(self):
        assert self.handler is not None, "Consumer Handler can not be None"
        if isinstance(self.handler, SpecialHandler):
            return
        _, eil = check_handler_function_sanity(self.handler).unpack()
        if eil:
            raise ValueError(
                f"Handler function {self.handler} does not meet the sanity requirements:\n{eil}"
            )

        self.body_pydantic_type = get_handler_body_type(self.handler)
        assert self.body_pydantic_type is not None, "Handler body type can not be None"


@dataclass
class ConnectionConfig:
    """MQ connection configuration"""

    url: str
    connection_name: str = DEFAULT_CORE_CONFIG.mq_connection_name
    heartbeat: int = DEFAULT_CORE_CONFIG.mq_heartbeat
    blocked_connection_timeout: int = DEFAULT_CORE_CONFIG.mq_blocked_connection_timeout


class AsyncSingleThreadMQConsumer:
    """
    High-performance async MQ consumer with runtime registration

    Features:
    - Runtime consumer registration
    - Efficient connection pooling
    - Automatic reconnection
    - Error handling and retry logic
    - Dead letter queue support
    - Graceful shutdown
    - Concurrent message processing
    """

    def __init__(self, connection_config: ConnectionConfig):
        self.connection_config = connection_config
        self.connection: Optional[AbstractConnection] = None
        self.consumers: Dict[str, ConsumerConfig] = {}
        self._publish_channle: Optional[AbstractChannel] = None
        self._consumer_loop_tasks: List[asyncio.Task] = []
        self._shutdown_event = asyncio.Event()
        self._processing_tasks: Set[asyncio.Task] = set()
        self.__running = False
        self._connection_lock = asyncio.Lock()  # Lock for connection operations
        self._stop_lock = asyncio.Lock()

    @property
    def running(self) -> bool:
        return self.__running

    async def connect(self) -> None:
        """Establish connection to MQ"""
        # Quick check without lock - if connection looks healthy, skip
        if self.connection and not self.connection.is_closed:
            return

        async with self._connection_lock:
            # Double-check after acquiring lock
            if self.connection and not self.connection.is_closed:
                return

            try:
                self.connection = await connect_robust(
                    self.connection_config.url,
                    client_properties={
                        "connection_name": self.connection_config.connection_name
                    },
                    heartbeat=self.connection_config.heartbeat,
                    blocked_connection_timeout=self.connection_config.blocked_connection_timeout,
                )
                self._publish_channle = await self.connection.channel()
                LOG.debug(
                    f"Connected to MQ (connection: {self.connection_config.connection_name})"
                )
            except Exception as e:
                LOG.error(f"Failed to connect to MQ: {str(e)}")
                raise e

    async def disconnect(self) -> None:
        """Close connection to MQ"""
        if self._publish_channle and not self._publish_channle.is_closed:
            await self._publish_channle.close()
            self._publish_channle = None
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            self.connection = None
        LOG.info("Disconnected from MQ")

    def register_consumer(self, consumer_config: ConsumerConfig) -> None:
        """Register a consumer at runtime"""
        if self.running:
            raise RuntimeError(
                "Cannot register consumers while the consumer is running"
            )

        self.consumers[consumer_config.queue_name] = consumer_config
        LOG.debug(
            f"Registered consumer - queue: {consumer_config.queue_name}, "
            f"exchange: {consumer_config.exchange_name}, "
            f"routing_key: {consumer_config.routing_key}"
        )

    async def _process_message(
        self,
        config: ConsumerConfig,
        message: Message,
        parent_context: Optional[Any] = None,
    ) -> None:
        """Process a single message with retry logic"""
        # Create span for message processing if OpenTelemetry is enabled
        span, process_context = _create_process_span(config, message, parent_context)

        try:
            async with message.process(requeue=False, ignore_processed=True):
                retry_count = 0
                max_retries = config.max_retries

                while retry_count <= max_retries:
                    try:
                        # process the body to json
                        try:
                            payload = json.loads(message.body.decode("utf-8"))
                            validated_body = config.body_pydantic_type.model_validate(
                                payload
                            )
                            _logging_vars = {
                                k: payload.get(k, None) for k in LOGGING_FIELDS
                            }
                            with bound_logging_vars(
                                queue_name=config.queue_name, **_logging_vars
                            ):
                                # Use the process context for handler execution
                                # OpenTelemetry uses contextvars which automatically propagate in async
                                # The process_context is already set when we create the span,
                                # so subsequent operations (DB queries, etc.) will automatically be in the same trace
                                if process_context and OTEL_AVAILABLE:
                                    token = otel_context.attach(process_context)
                                    try:
                                        _start_s = perf_counter()
                                        await asyncio.wait_for(
                                            config.handler(validated_body, message),
                                            timeout=config.timeout,
                                        )
                                        _end_s = perf_counter()
                                    finally:
                                        otel_context.detach(token)
                                else:
                                    _start_s = perf_counter()
                                    await asyncio.wait_for(
                                        config.handler(validated_body, message),
                                        timeout=config.timeout,
                                    )
                                    _end_s = perf_counter()

                                LOG.debug(
                                    f"Queue: {config.queue_name} processed in {_end_s - _start_s:.4f}s"
                                )
                                if span:
                                    span.set_attribute(
                                        "mq.processing_time_seconds", _end_s - _start_s
                                    )
                        except ValidationError as e:
                            LOG.error(
                                f"Message validation failed - queue: {config.queue_name}, "
                                f"error: {str(e)}"
                            )
                            if span:
                                _record_span_exception(span, e)
                                _set_span_status(
                                    span, StatusCode.ERROR, "Validation failed"
                                )
                            await message.reject(requeue=False)
                            return
                        except asyncio.TimeoutError:
                            timeout_error = TimeoutError(
                                f"Handler timeout after {config.timeout}s - queue: {config.queue_name}"
                            )
                            if span:
                                _record_span_exception(span, timeout_error)
                                _set_span_status(
                                    span, StatusCode.ERROR, "Handler timeout"
                                )
                            raise timeout_error

                        # Success
                        if span:
                            _set_span_status(span, StatusCode.OK)
                            span.set_attribute("mq.retry_count", retry_count)
                        return  # Success, exit retry loop

                    except Exception as e:
                        retry_count += 1
                        _wait_for = config.retry_delay * (retry_count**2)

                        if retry_count <= max_retries:
                            LOG.warning(
                                f"Message processing unknown error - queue: {config.queue_name}, "
                                f"attempt: {retry_count}/{config.max_retries}, "
                                f"retry after {_wait_for}s, "
                                f"error: {str(e)}.",
                                extra={"traceback": traceback.format_exc()},
                            )
                            if span:
                                span.set_attribute("mq.retry_count", retry_count)
                                span.set_attribute("mq.retry_delay_seconds", _wait_for)
                            await asyncio.sleep(_wait_for)  # Exponential backoff
                        else:
                            LOG.error(
                                f"Message processing failed permanently - queue: {config.queue_name}, "
                                f"error: {str(e)}",
                                extra={"traceback": traceback.format_exc()},
                            )
                            if span:
                                _record_span_exception(span, e)
                                _set_span_status(span, StatusCode.ERROR, str(e))
                                span.set_attribute("mq.retry_count", retry_count)
                                span.set_attribute("mq.failed_permanently", True)
                            # goto DLX if any
                            await message.reject(requeue=False)
                            return
        finally:
            if span:
                span.end()

    def cleanup_message_task(self, consumer_name: str, task: asyncio.Task) -> None:
        try:
            task.result()
        except asyncio.CancelledError:
            pass
        except ChannelInvalidStateError as e:
            LOG.warning(
                f"{consumer_name}: Message channel invalid: {e}. {traceback.format_exc()}"
            )
        except Exception as e:
            LOG.error(
                f"{consumer_name}: Message task unknown error: {e}, {traceback.format_exc()}"
            )
        finally:
            self._processing_tasks.discard(task)
            LOG.debug(f"#Current Processing Tasks: {len(self._processing_tasks)}")

    async def _process_message_with_tracing(
        self, config: ConsumerConfig, message: Message
    ) -> None:
        """Process a message with OpenTelemetry tracing support."""
        # Extract trace context from message headers if available
        extracted_context = _extract_trace_context_from_headers(message)

        # Create span for message consumption if OpenTelemetry is enabled
        consume_span, consume_context = _create_consume_span(
            config, message, extracted_context
        )

        try:
            # Pass consume_context to process_message so it can create child spans
            return await self._process_message(config, message, consume_context)
        finally:
            if consume_span:
                consume_span.end()

    async def _special_queue(self, config: ConsumerConfig) -> str:
        if config.handler is SpecialHandler.NO_PROCESS:
            return f"Special consumer - queue: {config.queue_name} <- ({config.exchange_name}, {config.routing_key}), {config.handler}."
        raise RuntimeError(f"Special handler {config.handler} not implemented")

    async def _consume_queue(self, config: ConsumerConfig) -> str:
        """Consume messages from a specific queue with automatic channel reconnection"""

        max_reconnect_attempts = DEFAULT_CORE_CONFIG.mq_max_reconnect_attempts
        reconnect_delay = DEFAULT_CORE_CONFIG.mq_reconnect_delay
        attempt = 0

        while not self._shutdown_event.is_set():
            consumer_channel: AbstractChannel | None = None
            try:
                # Ensure connection is alive
                if not self.connection or self.connection.is_closed:
                    LOG.warning(
                        f"Connection lost for queue {config.queue_name}, reconnecting..."
                    )
                    await self.connect()

                # Create a new channel for this consumer
                consumer_channel = await self.connection.channel()
                await consumer_channel.set_qos(prefetch_count=config.prefetch_count)
                queue = await self._setup_consumer_on_channel(config, consumer_channel)

                # Reset reconnect counter on successful setup
                attempt = 0

                if isinstance(config.handler, SpecialHandler):
                    hint = await self._special_queue(config)
                    return hint

                LOG.info(
                    f"Looping consumer - queue: {config.queue_name} <- ({config.exchange_name}, {config.routing_key})"
                )

                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        if self._shutdown_event.is_set():
                            break

                        # Process message in background task for concurrency
                        task = asyncio.create_task(
                            self._process_message_with_tracing(config, message)
                        )
                        self._processing_tasks.add(task)
                        task.add_done_callback(
                            partial(
                                self.cleanup_message_task,
                                config.queue_name,
                            )
                        )

                # If we exit the loop normally (shutdown), break the reconnect loop
                if self._shutdown_event.is_set():
                    break

            except asyncio.CancelledError:
                LOG.info(f"Consumer cancelled - queue: {config.queue_name}")
                raise  # Re-raise to allow proper cancellation
            except Exception as e:
                attempt += 1
                if attempt > max_reconnect_attempts:
                    LOG.error(
                        f"Consumer failed after {max_reconnect_attempts} reconnection attempts - "
                        f"queue: {config.queue_name}, error: {str(e)}"
                    )
                    raise e
                _delay_seconds = reconnect_delay * (attempt**2)
                LOG.warning(
                    f"Consumer error - queue: {config.queue_name}, error: {str(e)}, "
                    f"attempt: {attempt}/{max_reconnect_attempts}, "
                    f"reconnecting in {_delay_seconds}s..."
                )
                await asyncio.sleep(_delay_seconds)

            finally:
                if consumer_channel and not consumer_channel.is_closed:
                    try:
                        await consumer_channel.close()
                        LOG.debug(
                            f"Closed consumer channel - queue: {config.queue_name}"
                        )
                    except Exception as e:
                        LOG.warning(
                            f"Error closing channel - queue: {config.queue_name}: {e}"
                        )
                LOG.info(f"Consumer channel closed - queue: {config.queue_name}")

    async def _setup_consumer_on_channel(
        self,
        config: ConsumerConfig,
        channel: AbstractChannel,
    ) -> AbstractQueue:
        """Setup exchange, queue, and bindings for a consumer on a specific channel"""
        # Declare exchange
        exchange = await channel.declare_exchange(
            config.exchange_name, config.exchange_type, durable=config.durable
        )
        queue_arguments: dict = {
            "x-message-ttl": config.message_ttl_seconds * 1000,
        }
        # Setup dead letter exchange if specified
        # TODO: implement dead-letter init
        if config.need_dlx_queue and config.use_dlx_ex_rk is None:
            dlx_exchange_name = f"{config.exchange_name}.{config.dlx_suffix}"
            dlx_routing_key = f"{config.routing_key}.{config.dlx_suffix}"
            dlq_name = f"{config.queue_name}.{config.dlx_suffix}"

            dlx = await channel.declare_exchange(
                dlx_exchange_name, ExchangeType.DIRECT, durable=True
            )

            # Create dead letter queue
            dlq = await channel.declare_queue(
                dlq_name,
                durable=True,
                arguments={"x-message-ttl": 24 * 60 * 60 * config.dlx_ttl_days * 1000},
            )
            await dlq.bind(dlx, dlx_routing_key)

            queue_arguments["x-dead-letter-exchange"] = dlx_exchange_name
            queue_arguments["x-dead-letter-routing-key"] = dlx_routing_key

        if config.need_dlx_queue and config.use_dlx_ex_rk is not None:
            LOG.info(f"Queue {config.queue_name} uses DLX {config.use_dlx_ex_rk}")
            queue_arguments["x-dead-letter-exchange"] = config.use_dlx_ex_rk[0]
            queue_arguments["x-dead-letter-routing-key"] = config.use_dlx_ex_rk[1]

        # Declare queue
        queue = await channel.declare_queue(
            config.queue_name,
            durable=config.durable,
            auto_delete=config.auto_delete,
            arguments=queue_arguments,
        )

        # Bind queue to exchange
        await queue.bind(exchange, config.routing_key)

        return queue

    async def _force_reconnect(self) -> None:
        """Force a full reconnection, safely closing old connection if possible"""
        async with self._connection_lock:
            LOG.warning("Forcing full MQ reconnection...")

            # Try to close the old connection gracefully
            old_connection = self.connection
            self._publish_channle = None
            self.connection = None

            if old_connection:
                try:
                    if not old_connection.is_closed:
                        await old_connection.close()
                except Exception as e:
                    # Ignore errors when closing a broken connection
                    LOG.debug(f"Error closing old connection (ignored): {e}")

            # Now reconnect - connect() will acquire the lock again, but that's okay
            # since we're releasing it here. Actually, let's just do the connection inline.
            try:
                self.connection = await connect_robust(
                    self.connection_config.url,
                    client_properties={
                        "connection_name": self.connection_config.connection_name
                    },
                    heartbeat=self.connection_config.heartbeat,
                    blocked_connection_timeout=self.connection_config.blocked_connection_timeout,
                )
                self._publish_channle = await self.connection.channel()
                LOG.info("MQ reconnection successful")
            except Exception as e:
                LOG.error(f"Failed to reconnect to MQ: {str(e)}")
                raise

    async def _ensure_publish_channel(self) -> None:
        """Ensure we have a valid publish channel, reconnecting if necessary"""
        # First ensure we have a connection
        if self.connection is None or self.connection.is_closed:
            LOG.warning("Connection is closed, reconnecting...")
            self._publish_channle = None
            await self.connect()
            return

        # Connection is open, check the channel
        if self._publish_channle is None or self._publish_channle.is_closed:
            LOG.debug("Creating new publish channel...")
            try:
                self._publish_channle = await self.connection.channel()
            except RuntimeError as e:
                # Connection may report is_closed=False but actually be closed
                # This is a known issue with aio_pika/aiormq
                if "closed" in str(e).lower():
                    LOG.warning(f"Connection appears open but is actually closed: {e}")
                    # Force full reconnection with proper cleanup
                    await self._force_reconnect()
                else:
                    raise

    async def publish(self, exchange_name: str, routing_key: str, body: str) -> None:
        """Publish a message to an exchange without declaring it"""
        assert len(exchange_name) and len(routing_key)

        # Create span for message publishing and inject trace context into headers
        span, headers = _create_publish_span_and_headers(
            exchange_name, routing_key, body
        )

        max_retries = 3
        retry_delay = 1.0
        last_exception = None

        try:
            for attempt in range(max_retries):
                try:
                    await self._ensure_publish_channel()

                    if self._publish_channle is None:
                        raise RuntimeError(
                            "No active MQ Publish Channel after reconnection"
                        )

                    # Create the message with trace context in headers
                    message = Message(
                        body.encode("utf-8"),
                        content_type="application/json",
                        delivery_mode=2,  # Make message persistent
                        headers=headers if headers else None,
                    )

                    exchange = await self._publish_channle.get_exchange(exchange_name)
                    await exchange.publish(message, routing_key=routing_key)

                    LOG.debug(
                        f"Published message to exchange: {exchange_name}, routing_key: {routing_key}"
                    )

                    if span:
                        _set_span_status(span, StatusCode.OK)
                    return  # Success, exit the retry loop

                except Exception as e:
                    last_exception = e
                    # Check if it's a connection-related error that we should retry
                    is_connection_error = "closed" in str(e).lower() or isinstance(
                        e, (ConnectionError, RuntimeError)
                    )

                    if is_connection_error and attempt < max_retries - 1:
                        wait_time = retry_delay * (attempt + 1)
                        LOG.warning(
                            f"Publish failed (attempt {attempt + 1}/{max_retries}), "
                            f"retrying in {wait_time}s: {str(e)}"
                        )
                        # Reset channel to force reconnection on next attempt
                        self._publish_channle = None
                        await asyncio.sleep(wait_time)
                    else:
                        # Either not a connection error or we've exhausted retries
                        if span:
                            _record_span_exception(span, e)
                            _set_span_status(span, StatusCode.ERROR, str(e))
                        raise

            # If we get here, we've exhausted all retries (shouldn't happen due to raise above)
            if last_exception:
                if span:
                    _record_span_exception(span, last_exception)
                    _set_span_status(span, StatusCode.ERROR, str(last_exception))
                raise last_exception
        finally:
            if span:
                span.end()

    # TODO: add connection recovery logic
    async def start(self) -> None:
        """Start all registered consumers"""
        if self.running:
            raise RuntimeError("Consumer is already running")

        if not self.consumers:
            raise RuntimeError("No consumers registered")

        if not self.connection or self.connection.is_closed:
            await self.connect()

        self.__running = True
        self._shutdown_event.clear()

        # Start consumer tasks
        for config in self.consumers.values():
            task = asyncio.create_task(self._consume_queue(config))
            self._consumer_loop_tasks.append(task)

        LOG.info(f"Started all consumers (count: {len(self.consumers)})")
        try:
            # Wait for shutdown signal or any task to complete
            while not self._shutdown_event.is_set():
                # special handlers maybe return earlier
                done, pending = await asyncio.wait(
                    self._consumer_loop_tasks
                    + [asyncio.create_task(self._shutdown_event.wait())],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                # If shutdown event was triggered, tasks will be cancelled in stop()
                for task in done:
                    try:
                        r = (
                            task.result()
                        )  # This will raise the exception if task failed
                        if task in self._consumer_loop_tasks:
                            self._consumer_loop_tasks.remove(task)
                            LOG.info(
                                f"Consumer task completed. {r}. Remaining tasks: {len(self._consumer_loop_tasks)}"
                            )
                    except Exception as e:
                        LOG.error(
                            f"Consumer task failed: {e}. Remaining tasks: {len(self._consumer_loop_tasks)}"
                        )
                        return
            LOG.info("Shutdown event received")
        finally:
            await self.stop()

    async def stop_current_tasks(self) -> None:
        self._shutdown_event.set()
        # Cancel all consumer tasks
        LOG.info(f"Stopping {len(self._consumer_loop_tasks)} consumers...")
        for task in self._consumer_loop_tasks:
            task.cancel()

        # Wait for tasks to complete
        if self._consumer_loop_tasks:
            await asyncio.gather(*self._consumer_loop_tasks, return_exceptions=True)

        # Cancel all in-flight message processing tasks
        LOG.info(f"Stopping {len(self._processing_tasks)} tasks...")
        if self._processing_tasks:
            for task in list(self._processing_tasks):
                task.cancel()
            await asyncio.gather(*self._processing_tasks, return_exceptions=True)
            self._processing_tasks.clear()

        self._consumer_loop_tasks.clear()

    async def stop(self) -> None:
        """Stop all consumers gracefully"""
        async with self._stop_lock:
            if self.running:
                await self.stop_current_tasks()

            self.__running = False
            await self.disconnect()
            LOG.info("All consumers stopped")

    async def health_check(self) -> bool:
        """Check if the consumer is healthy"""
        await self.connect()
        if not self.connection or self.connection.is_closed:
            return False
        return True


MQ_CLIENT = AsyncSingleThreadMQConsumer(
    ConnectionConfig(
        url=DEFAULT_CORE_CONFIG.mq_url,
        connection_name=DEFAULT_CORE_CONFIG.mq_connection_name,
    )
)


# Decorator for easy handler registration
def register_consumer(config: ConsumerConfigData):
    """Decorator to register a function as a message handler"""

    def decorator(func: Callable[[dict, Message], Awaitable[Any]] | SpecialHandler):
        _consumer_config = ConsumerConfig(**config.__dict__, handler=func)
        MQ_CLIENT.register_consumer(_consumer_config)
        return func

    return decorator


async def publish_mq(exchange_name: str, routing_key: str, body: str) -> None:
    await MQ_CLIENT.publish(exchange_name, routing_key, body)


async def init_mq() -> None:
    """Initialize MQ connection (perform health check)."""
    if await MQ_CLIENT.health_check():
        LOG.info("MQ connection initialized successfully")
    else:
        LOG.error("Failed to initialize MQ connection")
        raise ConnectionError("Could not connect to MQ")
    await MQ_CLIENT.connect()


async def start_mq() -> None:
    await MQ_CLIENT.start()


async def close_mq() -> None:
    await MQ_CLIENT.stop()
