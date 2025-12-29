from typing import Dict, List, Optional, Tuple
import httpx
from pydantic import ValidationError
from ...base import CodeExecutor
from .models import (
    RunCodeResponse,
    DependenciesResponse,
    MessageResponse,
    DependencyItem,
)


class DifyCodeExecutor(CodeExecutor):
    """
    Dify Sandbox code executor implementation.
    
    Executes code via Dify Sandbox HTTP API.
    Supports Python3 and Node.js script execution.
    """

    def __init__(
        self,
        executor_id: str,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """
        Initialize Dify Code Executor.
        
        Args:
            executor_id: Unique identifier for this executor instance
            base_url: Dify Sandbox API base URL (e.g., "http://localhost:8194")
            api_key: API key for authentication
        """
        default_base_url = base_url or "http://localhost:8194"
        super().__init__(executor_id, base_url=default_base_url)
        self._api_key = api_key or "your-api-key"

    async def exec_script(
        self,
        script: str,
        language: str,
        timeout: float = 10.0,
        enable_network: bool = True,
        preload: Optional[str] = None,
        **kwargs,
    ) -> Tuple[int, str, str]:
        """
        Execute a script via Dify Sandbox API.

        Args:
            script: Script content to execute
            language: Programming language - "python3" or "nodejs" for Dify Sandbox
            timeout: Request timeout in seconds (default: 10.0)
            enable_network: Whether to enable network access (default: True)
            preload: Preload code to execute before the main script (e.g., for setting env vars)
            **kwargs: Additional parameters (e.g., workdir for other implementations)
        
        Returns:
            Tuple of (exit_code, stdout, stderr)
        
        Raises:
            ValueError: If language is not supported
            TimeoutError: If request times out
            RuntimeError: If API request fails
        """
        # Map language to Dify Sandbox language
        language_lower = language.lower()
        language_map = {
            "python": "python3",
            "python3": "python3",
            "node": "nodejs",
            "nodejs": "nodejs",
        }
        
        mapped_language = language_map.get(language_lower)
        if not mapped_language:
            raise ValueError(
                f"Unsupported language: {language}. "
                f"Supported languages: {list(language_map.keys())}"
            )
        
        # Prepare request payload
        payload = {
            "language": mapped_language,
            "code": script,
            "enable_network": enable_network,
        }
        
        # Add preload code if provided
        # Note: This feature requires setting `enable_preload: True` in Dify Sandbox config
        if preload:
            payload["preload"] = preload
        
        headers = {
            "X-Api-Key": self._api_key,
            "Content-Type": "application/json",
        }
        
        try:
            client = self._get_client()
            response = await client.post(
                f"{self._base_url}/v1/sandbox/run",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            
            if response.status_code == 401:
                raise RuntimeError("Unauthorized: Invalid API key")
            elif response.status_code != 200:
                raise RuntimeError(
                    f"Dify Sandbox API error: {response.status_code} - {response.text}"
                )
            
            # Parse response using Pydantic model
            try:
                result: RunCodeResponse = RunCodeResponse.model_validate(response.json())
            except ValidationError as e:
                raise RuntimeError(f"Invalid response format: {e}")
            
            # Check for API-level errors
            if result.is_error:
                return (1, "", result.message)
            
            # Extract data
            if result.data is None:
                return (1, "", "No data in response")
            
            stdout = result.data.stdout or ""
            stderr = result.data.error or ""
            
            # Determine exit code (0 for success, 1 for error)
            exit_code = 0 if not stderr else 1
            
            return (exit_code, stdout, stderr)
                
        except httpx.TimeoutException:
            raise TimeoutError(f"Request timeout after {timeout} seconds")
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to connect to Dify Sandbox: {e}")

    async def health_check(
        self,
        timeout: float = 5.0,
    ) -> bool:
        """
        Check if Dify Sandbox service is healthy.
        
        Args:
            timeout: Request timeout in seconds (default: 5.0)
        
        Returns:
            True if the service is healthy, False otherwise
        """
        try:
            client = self._get_client()
            response = await client.get(
                f"{self._base_url}/health",
                timeout=timeout,
            )
            # Dify Sandbox returns "ok" as plain text (not JSON)
            return response.status_code == 200 and response.text.strip() == '"ok"'
        except Exception:
            return False

    async def get_dependencies(
        self, 
        language: str = "python3", 
        timeout: float = 30.0
    ) -> List[DependencyItem]:
        """
        Get the list of installed dependencies for the specified language.
        
        Args:
            language: Programming language, currently only "python3" is supported
            timeout: Request timeout in seconds (default: 30.0)
        
        Returns:
            List of DependencyItem objects (e.g., [DependencyItem(name="httpx", version="0.27.0"), ...])
        
        Raises:
            RuntimeError: If API request fails
            TimeoutError: If request times out
        """
        headers = {
            "X-Api-Key": self._api_key,
        }
        
        try:
            client = self._get_client()
            response = await client.get(
                f"{self._base_url}/v1/sandbox/dependencies",
                params={"language": language},
                headers=headers,
                timeout=timeout,
            )
            
            if response.status_code == 401:
                raise RuntimeError("Unauthorized: Invalid API key")
            elif response.status_code != 200:
                raise RuntimeError(
                    f"Dify Sandbox API error: {response.status_code} - {response.text}"
                )
            
            # Parse response using Pydantic model
            try:
                result: DependenciesResponse = DependenciesResponse.model_validate(response.json())
            except ValidationError as e:
                raise RuntimeError(f"Invalid response format: {e}")
            
            # Check for API-level errors
            if result.is_error:
                raise RuntimeError(f"Failed to get dependencies: {result.message}")
            
            # Extract dependencies
            if result.data is None:
                return []
            
            return result.data.dependencies
            
        except httpx.TimeoutException:
            raise TimeoutError(f"Request timeout after {timeout} seconds")
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to connect to Dify Sandbox: {e}")

    async def update_dependencies(
        self, 
        language: str = "python3", 
        timeout: float = 300.0
    ) -> str:
        """
        Update dependencies by rebuilding the dependency sandbox environment.
        
        Note: This does NOT reinstall packages. It only rebuilds the isolation environment
        based on already installed dependencies. To reinstall packages, use refresh_dependencies().
        Requires admin permissions and may take a long time.
        
        Args:
            language: Programming language, currently only "python3" is supported
            timeout: Request timeout in seconds (default: 300.0, 5 minutes)
        
        Returns:
            Success message
        
        Raises:
            RuntimeError: If API request fails or permission denied
            TimeoutError: If request times out
        """
        payload = {
            "language": language,
        }
        
        headers = {
            "X-Api-Key": self._api_key,
            "Content-Type": "application/json",
        }
        
        try:
            client = self._get_client()
            response = await client.post(
                f"{self._base_url}/v1/sandbox/dependencies/update",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            
            if response.status_code == 401:
                raise RuntimeError("Unauthorized: Invalid API key")
            elif response.status_code == 403:
                raise RuntimeError("Permission denied: Admin access required")
            elif response.status_code != 200:
                raise RuntimeError(
                    f"Dify Sandbox API error: {response.status_code} - {response.text}"
                )
            
            # Parse response using Pydantic model
            try:
                result: MessageResponse = MessageResponse.model_validate(response.json())
            except ValidationError as e:
                raise RuntimeError(f"Invalid response format: {e}")
            
            # Check for API-level errors
            if result.is_error:
                raise RuntimeError(f"Failed to update dependencies: {result.message}")
            
            # Extract message
            if result.data is None:
                return "Dependencies updated successfully"
            
            return result.data.message
                
        except httpx.TimeoutException:
            raise TimeoutError(f"Request timeout after {timeout} seconds")
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to connect to Dify Sandbox: {e}")

    async def refresh_dependencies(
        self, 
        language: str = "python3", 
        timeout: float = 600.0
    ) -> str:
        """
        Refresh dependencies by reinstalling packages from requirements.txt and rebuilding environment.
        
        This will:
        1. Read dependencies/python-requirements.txt
        2. Reinstall all packages using pip3 install
        3. Rebuild the dependency sandbox environment
        
        Requires admin permissions and may take a long time.
        
        Args:
            language: Programming language, currently only "python3" is supported
            timeout: Request timeout in seconds (default: 600.0, 10 minutes)
        
        Returns:
            Success message
        
        Raises:
            RuntimeError: If API request fails or permission denied
            TimeoutError: If request times out
        """
        headers = {
            "X-Api-Key": self._api_key,
        }
        
        try:
            client = self._get_client()
            response = await client.get(
                f"{self._base_url}/v1/sandbox/dependencies/refresh",
                params={"language": language},
                headers=headers,
                timeout=timeout,
            )
            
            if response.status_code == 401:
                raise RuntimeError("Unauthorized: Invalid API key")
            elif response.status_code == 403:
                raise RuntimeError("Permission denied: Admin access required")
            elif response.status_code != 200:
                raise RuntimeError(
                    f"Dify Sandbox API error: {response.status_code} - {response.text}"
                )
            
            # Parse response using Pydantic model
            try:
                result: MessageResponse = MessageResponse.model_validate(response.json())
            except ValidationError as e:
                raise RuntimeError(f"Invalid response format: {e}")
            
            # Check for API-level errors
            if result.is_error:
                raise RuntimeError(f"Failed to refresh dependencies: {result.message}")
            
            # Extract message
            if result.data is None:
                return "Dependencies refreshed successfully"
            
            return result.data.message
            
        except httpx.TimeoutException:
            raise TimeoutError(f"Request timeout after {timeout} seconds")
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to connect to Dify Sandbox: {e}")

