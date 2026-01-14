import asyncio
from typing import Optional, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager

import aiobotocore.session
from aiobotocore.config import AioConfig
from aiobotocore.client import AioBaseClient
from aiobotocore.session import get_session as get_aiobotocore_session

from botocore.exceptions import ClientError, NoCredentialsError

from ..env import LOG as logger
from ..env import DEFAULT_CORE_CONFIG


def _handle_s3_client_error(
    e: ClientError, bucket_name: str, key: str, ignore_not_found: bool = False
) -> None:
    """
    Handle S3 ClientError with consistent logging and error processing.

    Args:
        e: The ClientError exception
        operation: Description of the operation (e.g., "downloading", "uploading", "deleting")
        bucket_name: S3 bucket name
        key: S3 object key
        handle_not_found: Whether to handle NoSuchKey/404 errors specially
        not_found_log_level: Log level for not found errors ("error", "warning", "debug")
    """
    error_code = e.response["Error"]["Code"]
    if error_code in ("NoSuchKey", "404") and ignore_not_found:
        logger.warning(f"Object not found - bucket: {bucket_name}, key: {key}")
        return
    else:
        logger.error(
            f"S3 client error - bucket: {bucket_name}, key: {key}, error: {error_code}"
        )
    raise e


def _handle_unexpected_error(e: Exception, bucket_name: str, key: str) -> None:
    """
    Handle unexpected (non-ClientError) exceptions with consistent logging.

    Args:
        e: The exception
        operation: Description of the operation (e.g., "downloading object", "uploading object")
        bucket_name: S3 bucket name
        key: S3 object key
    """
    logger.error(
        f"Unexpected S3 error - bucket: {bucket_name}, key: {key}, error: {str(e)}"
    )
    raise e


class S3Client:
    """
    Best-practice async S3 client for read-only operations.

    Features:
    - Async S3 operations using aiobotocore
    - Built-in connection pooling via aiohttp connector
    - Session management with proper lifecycle
    - Health checks and monitoring
    - Configuration via environment variables
    """

    def __init__(self, s3_config: Dict[str, Any] = {}):
        # Use provided config or fall back to global DEFAULT_CORE_CONFIG
        self.endpoint = s3_config.get("endpoint", DEFAULT_CORE_CONFIG.s3_endpoint)
        self.region = s3_config.get("region", DEFAULT_CORE_CONFIG.s3_region)
        self.access_key = s3_config.get("access_key", DEFAULT_CORE_CONFIG.s3_access_key)
        self.secret_key = s3_config.get("secret_key", DEFAULT_CORE_CONFIG.s3_secret_key)
        self.bucket = s3_config.get("bucket", DEFAULT_CORE_CONFIG.s3_bucket)
        self.use_path_style = s3_config.get(
            "use_path_style", DEFAULT_CORE_CONFIG.s3_use_path_style
        )
        self.max_pool_connections = s3_config.get(
            "max_pool_connections", DEFAULT_CORE_CONFIG.s3_max_pool_connections
        )
        self.connection_timeout = s3_config.get(
            "connection_timeout", DEFAULT_CORE_CONFIG.s3_connection_timeout
        )
        self.read_timeout = s3_config.get(
            "read_timeout", DEFAULT_CORE_CONFIG.s3_read_timeout
        )

        if not self.bucket:
            raise ValueError("S3 bucket name is required")

        logger.debug(
            f"S3 Client Config - Region: {self.region}, Bucket: {self.bucket}, Endpoint: {self.endpoint}"
        )

        # Create aiobotocore session
        # self._session: aiobotocore.session.AioSession = self._create_session()
        self._session: aiobotocore.session.AioSession = get_aiobotocore_session()
        self._client: AioBaseClient = None
        self._client_lock: asyncio.Lock = None

    @property
    def client_lock(self):
        """Lazy-load the client lock to ensure it's created in the correct event loop."""
        if self._client_lock is None:
            self._client_lock = asyncio.Lock()
        return self._client_lock

    def _create_session(self) -> aiobotocore.session.AioSession:
        """Create aiobotocore session with optimal settings."""
        session = aiobotocore.session.AioSession()
        logger.info("S3 session created")
        return session

    async def _get_client(self) -> AioBaseClient:
        """Get or create S3 client instance with connection pooling."""
        if self._client is not None:
            return self._client
        async with self.client_lock:
            # Double-check pattern to avoid race conditions
            if self._client is not None:
                return self._client
            # Create config with path-style addressing if needed
            config_kwargs = {
                "region_name": self.region,
                "retries": {"max_attempts": 3},
                "max_pool_connections": self.max_pool_connections,
                "connect_timeout": self.connection_timeout,
                "read_timeout": self.read_timeout,
            }

            # Add S3-specific configuration for path-style addressing
            if self.use_path_style:
                config_kwargs["s3"] = {"addressing_style": "path"}

            config = AioConfig(**config_kwargs)

            # Build client creation kwargs
            client_kwargs = {
                "service_name": "s3",
                "config": config,
            }

            # Add credentials if provided
            if self.access_key and self.secret_key:
                client_kwargs["aws_access_key_id"] = self.access_key
                client_kwargs["aws_secret_access_key"] = self.secret_key

            # Add custom endpoint if provided
            if self.endpoint:
                client_kwargs["endpoint_url"] = self.endpoint

            # Create client directly
            self._client = await self._session.create_client(
                **client_kwargs
            ).__aenter__()

            # OpenTelemetry instrumentation handled globally at startup

        return self._client

    async def get_session(self) -> aiobotocore.session.AioSession:
        """
        Get the aiobotocore session instance.

        The session handles connection pooling internally.
        """
        return self._session

    @asynccontextmanager
    async def get_client(self) -> AsyncGenerator[AioBaseClient, None]:
        """
        Get S3 client with context manager support.

        This maintains the same interface but now uses a singleton client
        that preserves connection pooling.

        Usage:
            async with s3_client.get_client() as client:
                response = await client.get_object(Bucket='bucket', Key='key')
        """
        try:
            yield await self._get_client()
        except Exception:
            # Don't close the client on exceptions - let it be reused
            raise

    async def download_object(self, key: str, bucket: Optional[str] = None) -> bytes:
        """
        Download S3 object content as bytes.

        Args:
            key: The S3 object key
            bucket: Optional bucket name (uses default if not specified)

        Returns:
            bytes: The object content

        Raises:
            ClientError: If the object doesn't exist or other S3 errors
            NoCredentialsError: If credentials are not configured
        """
        bucket_name = bucket or self.bucket

        try:
            async with self.get_client() as client:
                response = await client.get_object(Bucket=bucket_name, Key=key)
                content = await response["Body"].read()
                logger.debug(
                    f"Downloaded object - bucket: {bucket_name}, key: {key}, size: {len(content)} bytes"
                )
                return content

        except ClientError as e:
            _handle_s3_client_error(e, bucket_name, key)
        except Exception as e:
            _handle_unexpected_error(e, bucket_name, key)

    async def upload_object(
        self,
        key: str,
        data: bytes,
        bucket: Optional[str] = None,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Upload data to S3 object.

        Args:
            key: The S3 object key
            data: The data to upload as bytes
            bucket: Optional bucket name (uses default if not specified)
            content_type: Optional content type (e.g., 'image/jpeg', 'text/plain')
            metadata: Optional user-defined metadata

        Returns:
            Dict containing upload response (ETag, VersionId if versioning enabled, etc.)

        Raises:
            ClientError: If upload fails or other S3 errors
            NoCredentialsError: If credentials are not configured
        """
        bucket_name = bucket or self.bucket

        try:
            # Prepare put_object arguments
            put_args = {"Bucket": bucket_name, "Key": key, "Body": data}

            if content_type:
                put_args["ContentType"] = content_type

            if metadata:
                put_args["Metadata"] = metadata

            async with self.get_client() as client:
                response = await client.put_object(**put_args)
                # Remove ResponseMetadata as it's not useful for application logic
                result = {k: v for k, v in response.items() if k != "ResponseMetadata"}
                logger.debug(
                    f"Uploaded object - bucket: {bucket_name}, key: {key}, size: {len(data)} bytes"
                )
                return result

        except ClientError as e:
            _handle_s3_client_error(e, bucket_name, key)
        except Exception as e:
            _handle_unexpected_error(e, bucket_name, key)

    async def delete_object(
        self, key: str, bucket: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Delete an S3 object.

        Args:
            key: The S3 object key
            bucket: Optional bucket name (uses default if not specified)

        Returns:
            Dict containing delete response (DeleteMarker, VersionId if versioning enabled, etc.)

        Raises:
            ClientError: If the object doesn't exist or other S3 errors
            NoCredentialsError: If credentials are not configured
        """
        bucket_name = bucket or self.bucket

        try:
            async with self.get_client() as client:
                response = await client.delete_object(Bucket=bucket_name, Key=key)
                # Remove ResponseMetadata as it's not useful for application logic
                result = {k: v for k, v in response.items() if k != "ResponseMetadata"}
                logger.debug(f"Deleted object - bucket: {bucket_name}, key: {key}")
                return result

        except ClientError as e:
            _handle_s3_client_error(e, bucket_name, key, ignore_not_found=True)
        except Exception as e:
            _handle_unexpected_error(e, bucket_name, key)

    async def get_object_metadata(
        self, key: str, bucket: Optional[str] = None
    ) -> Dict[str, Any] | None:
        """
        Get object metadata without downloading content.

        Args:
            key: The S3 object key
            bucket: Optional bucket name (uses default if not specified)

        Returns:
            Dict containing metadata (ContentLength, ETag, ContentType, LastModified, etc.)

        Raises:
            ClientError: If the object doesn't exist or other S3 errors
        """
        bucket_name = bucket or self.bucket

        try:
            async with self.get_client() as client:
                response = await client.head_object(Bucket=bucket_name, Key=key)
                # Remove ResponseMetadata as it's not useful for application logic
                metadata = {
                    k: v for k, v in response.items() if k != "ResponseMetadata"
                }
                logger.debug(f"Retrieved metadata - bucket: {bucket_name}, key: {key}")
                return metadata

        except ClientError as e:
            _handle_s3_client_error(e, bucket_name, key, ignore_not_found=True)
            return None
        except Exception as e:
            _handle_unexpected_error(e, bucket_name, key)

    async def health_check(
        self, max_retries: int = 5, retry_delay: float = 2.0
    ) -> bool:
        """
        Perform health check with bucket HEAD operation with retry logic.

        Args:
            max_retries: Maximum number of retry attempts (default: 5)
            retry_delay: Delay in seconds between retries (default: 2.0)

        Returns:
            bool: True if S3 is accessible, False otherwise
        """
        for attempt in range(1, max_retries + 1):
            try:
                async with self.get_client() as client:
                    await client.head_bucket(Bucket=self.bucket)
                    logger.debug(f"S3 health check passed - bucket: {self.bucket}")
                    return True

            except (ClientError, NoCredentialsError, Exception) as e:
                if attempt < max_retries:
                    logger.warning(
                        f"S3 health check failed (attempt {attempt}/{max_retries}) - "
                        f"bucket: {self.bucket}, error: {str(e)}, retrying in {retry_delay}s..."
                    )
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error(
                        f"S3 health check failed after {max_retries} attempts - "
                        f"bucket: {self.bucket}, error: {str(e)}"
                    )
                    return False

        return False

    def get_connection_status(self) -> Dict[str, Any]:
        """
        Get current session status for monitoring.

        Returns:
            Dict with connection status information
        """
        if not self._session:
            return {"status": "session_not_initialized"}
        if not self._client:
            return {"status": "client_not_initialized"}

        return {
            "session_initialized": self._session is not None,
            "client_initialized": self._client is not None,
            "max_pool_connections": self.max_pool_connections,
            "bucket": self.bucket,
            "region": self.region,
            "endpoint": self.endpoint,
        }

    async def close(self) -> None:
        """
        Close aiobotocore session and all connections.

        Called during application shutdown.
        """
        if self._client:
            try:
                await self._client.close()
            except Exception as e:
                logger.error(f"Error closing S3 client: {e}")
            finally:
                self._client = None

        if self._session:
            # aiobotocore session doesn't have explicit close method
            # Connections are cleaned up when client is closed
            self._session = None

        logger.info("S3 client connections closed")


# Global S3 client instance
S3_CLIENT = S3Client()


# FastAPI dependency function
async def get_s3_client() -> S3Client:
    """
    FastAPI dependency to get S3 client.

    Usage in FastAPI routes:
        @app.get("/download")
        async def download_file(s3: S3Client = Depends(get_s3_client)):
            content = await s3.download_object("path/to/file.txt")
            return {"size": len(content)}
    """
    return S3_CLIENT


# Convenience functions
async def init_s3() -> None:
    """Initialize S3 client (perform health check)."""
    if await S3_CLIENT.health_check():
        logger.debug(
            f"S3 client initialized successfully {S3_CLIENT.get_connection_status()}"
        )
    else:
        logger.error("Failed to initialize S3 client")
        raise ConnectionError("Could not connect to S3")


async def close_s3() -> None:
    """Close S3 client connections."""
    await S3_CLIENT.close()
    logger.info("S3 client closed")
