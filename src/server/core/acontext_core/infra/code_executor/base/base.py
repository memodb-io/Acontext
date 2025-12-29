from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional, Tuple
import httpx


class CodeExecutor(ABC):
    """
    Abstract base class for code execution backends.
    
    Code executors are responsible for executing code in various languages.
    Unlike SandboxRuntime, code executors focus specifically on code execution
    without file system operations.
    """

    def __init__(self, executor_id: str, base_url: Optional[str] = None) -> None:
        """
        Initialize code executor.
        
        Args:
            executor_id: Unique identifier for this executor instance
            base_url: Base URL for HTTP-based executors (optional)
        """
        self.executor_id = executor_id
        self._base_url: Optional[str] = base_url
        # Create a shared HTTP client with connection pooling for better performance
        # The client will be reused across all requests to enable connection reuse
        self._client: Optional[httpx.AsyncClient] = None

    @abstractmethod
    async def exec_script(
        self,
        script: str,
        language: str,
        timeout: float = 30.0,
        **kwargs,
    ) -> Tuple[int, str, str]:
        """
        Execute a script in the specified language.

        Args:
            script: Script content to execute
            language: Programming language (e.g., "python3", "nodejs")
            timeout: Maximum time in seconds to wait for completion (default: 30.0)
            **kwargs: Additional implementation-specific parameters (e.g., enable_network for Dify)

        Returns:
            Tuple containing:
                - exit_code: Exit code of the script (0 for success, non-zero for failure)
                - stdout: Standard output of the script
                - stderr: Standard error output of the script

        Raises:
            TimeoutError: If script execution exceeds the specified timeout
            RuntimeError: If script execution fails or executor is unavailable
            ValueError: If language is not supported
        """
        pass

    def _get_client(self) -> httpx.AsyncClient:
        """
        Get or create the shared HTTP client instance.
        
        Returns:
            The shared httpx.AsyncClient instance
        """
        if self._client is None:
            # Create client with default timeout (can be overridden per request)
            # Enable HTTP/2 and connection pooling for better performance
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                http2=False,
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
            )
        return self._client

    async def close(self) -> None:
        """
        Close the HTTP client and release resources.
        
        Should be called when the executor is no longer needed.
        """
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - closes the client."""
        await self.close()

