import asyncio
import json
import traceback
from enum import StrEnum
from pydantic import ValidationError, BaseModel
from dataclasses import dataclass, field
from typing import Callable, Awaitable, Any, Dict, Optional, List, Set
from aio_pika import connect_robust, ExchangeType, Message
from aio_pika.abc import (
    AbstractConnection,
    AbstractChannel,
    AbstractQueue,
    AbstractExchange,
)
from ..env import LOG, DEFAULT_CORE_CONFIG, bound_logging_vars
from ..util.handler_spec import check_handler_function_sanity, get_handler_body_type
from time import perf_counter


class SpecialHandler(StrEnum):
    NO_PROCESS = "no_process"


LOGGING_FIELDS = {"project_id", "session_id"}


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
    heartbeat: int = 32
    blocked_connection_timeout: int = 300


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

    @property
    def running(self) -> bool:
        return self.__running

    async def connect(self) -> None:
        """Establish connection to MQ"""
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
            LOG.info(
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
        LOG.info(
            f"Registered consumer - queue: {consumer_config.queue_name}, "
            f"exchange: {consumer_config.exchange_name}, "
            f"routing_key: {consumer_config.routing_key}"
        )

    async def _process_message(self, config: ConsumerConfig, message: Message) -> None:
        """Process a single message with retry logic"""
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
                            _start_s = perf_counter()
                            await asyncio.wait_for(
                                config.handler(validated_body, message),
                                timeout=config.timeout,
                            )
                            _end_s = perf_counter()
                            LOG.debug(
                                f"Queue: {config.queue_name} processed in {_end_s - _start_s:.4f}s"
                            )
                    except ValidationError as e:
                        LOG.error(
                            f"Message validation failed - queue: {config.queue_name}, "
                            f"error: {str(e)}"
                        )
                        await message.reject(requeue=False)
                        return
                    except asyncio.TimeoutError:
                        raise TimeoutError(
                            f"Handler timeout after {config.timeout}s - queue: {config.queue_name}"
                        )
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
                        await asyncio.sleep(_wait_for)  # Exponential backoff
                    else:
                        LOG.error(
                            f"Message processing failed permanently - queue: {config.queue_name}, "
                            f"error: {str(e)}",
                            extra={"traceback": traceback.format_exc()},
                        )
                        # goto DLX if any
                        await message.reject(requeue=False)
                        return

    def cleanup_message_task(self, task: asyncio.Task) -> None:
        try:
            task.result()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            LOG.error(f"Message task unknown error: {e}")
        finally:
            self._processing_tasks.discard(task)
            LOG.debug(f"#Current Processing Tasks: {len(self._processing_tasks)}")

    async def _special_queue(self, config: ConsumerConfig) -> str:
        if config.handler is SpecialHandler.NO_PROCESS:
            return f"Special consumer - queue: {config.queue_name} <- ({config.exchange_name}, {config.routing_key}), {config.handler}."
        raise RuntimeError(f"Special handler {config.handler} not implemented")

    # TODO: add channel recovery logic
    async def _consume_queue(self, config: ConsumerConfig) -> str:
        """Consume messages from a specific queue"""

        consumer_channel: AbstractChannel | None = None
        try:
            # Set QoS for this consumer
            consumer_channel = await self.connection.channel()
            await consumer_channel.set_qos(prefetch_count=config.prefetch_count)
            queue = await self._setup_consumer_on_channel(config, consumer_channel)

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
                    task = asyncio.create_task(self._process_message(config, message))

                    self._processing_tasks.add(task)
                    task.add_done_callback(self.cleanup_message_task)

        except Exception as e:
            LOG.error(f"Consumer error - queue: {config.queue_name}, error: {str(e)}")
            raise e
        finally:
            if consumer_channel and not consumer_channel.is_closed:
                LOG.info(f"Closing consumer channel - queue: {config.queue_name}")
                await consumer_channel.close()

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

    async def publish(self, exchange_name: str, routing_key: str, body: str) -> None:
        """Publish a message to an exchange without declaring it"""
        assert len(exchange_name) and len(routing_key)
        await self.connect()

        if self._publish_channle is None:
            raise RuntimeError("No active MQ Publish Channel")

        if self._publish_channle.is_closed:
            self._publish_channle = await self.connection.channel()
        # Create a channel for publishing
        # Create the message
        message = Message(
            body.encode("utf-8"),
            content_type="application/json",
            delivery_mode=2,  # Make message persistent
        )

        exchange = await self._publish_channle.get_exchange(exchange_name)
        await exchange.publish(message, routing_key=routing_key)

        LOG.debug(
            f"Published message to exchange: {exchange_name}, routing_key: {routing_key}"
        )

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

    async def stop(self) -> None:
        """Stop all consumers gracefully"""
        if not self.running:
            return

        self.__running = False
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
        await self.disconnect()
        LOG.info("All consumers stopped")

    async def health_check(self) -> bool:
        """Check if the consumer is healthy"""
        await self.connect()
        if not self.connection or self.connection.is_closed:
            return False
        return True


# Decorator for easy handler registration
def register_consumer(
    mq_client: AsyncSingleThreadMQConsumer, config: ConsumerConfigData
):
    """Decorator to register a function as a message handler"""

    def decorator(func: Callable[[dict, Message], Awaitable[Any]] | SpecialHandler):
        _consumer_config = ConsumerConfig(**config.__dict__, handler=func)
        mq_client.register_consumer(_consumer_config)
        return func

    return decorator


MQ_CLIENT = AsyncSingleThreadMQConsumer(
    ConnectionConfig(
        url=DEFAULT_CORE_CONFIG.mq_url,
        connection_name=DEFAULT_CORE_CONFIG.mq_connection_name,
    )
)


async def init_mq() -> None:
    """Initialize MQ connection (perform health check)."""
    if await MQ_CLIENT.health_check():
        LOG.info(f"MQ connection initialized successfully")
    else:
        LOG.error("Failed to initialize MQ connection")
        raise ConnectionError("Could not connect to MQ")


async def close_mq() -> None:
    await MQ_CLIENT.stop()
