from typing import Type
from datetime import datetime, timedelta
import os
import httpx
from agentic_sandbox import SandboxClient  # type: ignore


from .base import SandboxBackend
from ....schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
    SandboxStatus,
)
from ....env import DEFAULT_CORE_CONFIG, LOG as logger
from ...s3 import S3_CLIENT


class K8sSandboxBackend(SandboxBackend):
    """Kubernetes Sandbox Backend using agentic-sandbox SDK.
    
    This backend uses agentic-sandbox-client SDK to create sandboxes,
    and uses sandbox-router for operations. Stateless design.
    """
    
    type: str = "k8s"
    
    def __init__(
        self,
        router_url: str,
        template_name: str,
        namespace: str = "default",
        server_port: int = 8888,
    ):
        """Initialize K8s sandbox backend.
        
        Args:
            router_url: Sandbox router URL (e.g., "http://sandbox-router-svc.default.svc.cluster.local:8080")
            template_name: Name of the SandboxTemplate CR (e.g., "python-sandbox-template")
            namespace: Kubernetes namespace where sandboxes are created
            server_port: Port the sandbox runtime listens on (default: 8888)
        """
        self.__router_url = router_url.rstrip('/')
        self.__template_name = template_name
        self.__namespace = namespace
        self.__server_port = server_port
        self.__http_client = httpx.AsyncClient(timeout=60.0)
        
        # Initialize K8s API client using SDK
        self.temp_client = SandboxClient(
            template_name=template_name,
            namespace=namespace,
            api_url=router_url,
            server_port=server_port,
        )
        self.__custom_api = self.temp_client.custom_objects_api
    
    @classmethod
    def from_default(cls: Type["K8sSandboxBackend"]) -> "K8sSandboxBackend":
        """Create backend from default configuration."""
        if DEFAULT_CORE_CONFIG.k8s_sandbox_router_url is None:
            raise ValueError("k8s_sandbox_router_url must be configured")
        if DEFAULT_CORE_CONFIG.k8s_sandbox_template_name is None:
            raise ValueError("k8s_sandbox_template_name must be configured")
        
        return cls(
            router_url=DEFAULT_CORE_CONFIG.k8s_sandbox_router_url,
            template_name=DEFAULT_CORE_CONFIG.k8s_sandbox_template_name,
            namespace=DEFAULT_CORE_CONFIG.k8s_sandbox_namespace,
            server_port=DEFAULT_CORE_CONFIG.k8s_sandbox_server_port,
        )
    
    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo:
        """Create a new sandbox using agentic-sandbox SDK."""
        # Create temporary SandboxClient to create claim
   
        # Create the claim and wait for sandbox to be ready
        self.temp_client._create_claim()
        self.temp_client._wait_for_sandbox_ready()
        
        # Get the sandbox_id (claim name)
        sandbox_id = self.temp_client.claim_name
        
        # Get sandbox info
        created_at = datetime.now()
        # TODO: we need a cron job to delete expired sandboxes
        expires_at = created_at + timedelta(
            seconds=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds
        )
        
        logger.info(f"Created K8s sandbox: {sandbox_id}")
        
        return SandboxRuntimeInfo(
            sandbox_id=sandbox_id,
            sandbox_status=SandboxStatus.RUNNING,
            sandbox_created_at=created_at,
            sandbox_expires_at=expires_at,
        )
    
    async def kill_sandbox(self, sandbox_id: str) -> bool:
        """Delete a sandbox by deleting its SandboxClaim."""
        try:
            # Delete the SandboxClaim using K8s API
            self.__custom_api.delete_namespaced_custom_object(
                group="extensions.agents.x-k8s.io",
                version="v1alpha1",
                namespace=self.__namespace,
                plural="sandboxclaims",
                name=sandbox_id
            )
            
            logger.info(f"Killed K8s sandbox: {sandbox_id}")
            return True
        except Exception as e:
            # Check if it's a 404 (not found) error
            if hasattr(e, 'status') and e.status == 404:
                logger.warning(f"Sandbox {sandbox_id} not found")
                return True
            logger.error(f"Failed to kill sandbox {sandbox_id}: {e}")
            return False
    
    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo:
        """Get sandbox status by checking if it exists in K8s."""
        try:
            # Get the Sandbox resource
            self.__custom_api.get_namespaced_custom_object(
                group="agents.x-k8s.io",
                version="v1alpha1",
                namespace=self.__namespace,
                plural="sandboxes",
                name=sandbox_id
            )
            
            # FIXME: get time from status
            created_at = datetime.now()
            expires_at = created_at + timedelta(
                seconds=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds
            )
            
            return SandboxRuntimeInfo(
                sandbox_id=sandbox_id,
                sandbox_status=SandboxStatus.RUNNING,
                sandbox_created_at=created_at,
                sandbox_expires_at=expires_at,
            )
        except Exception as e:
            raise ValueError(f"Sandbox {sandbox_id} not found: {e}")
    
    async def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo:
        """Update sandbox - not supported for K8s sandboxes."""
        logger.warning(
            f"K8s sandboxes have fixed TTL. Ignoring update request for {sandbox_id}"
        )
        return await self.get_sandbox(sandbox_id)
    
    async def exec_command(
        self, sandbox_id: str, command: str
    ) -> SandboxCommandOutput:
        """Execute a command via router."""
        try:
            # Make HTTP request to sandbox via router
            response = await self.__http_client.post(
                f"{self.__router_url}/execute",
                json={"command": command},
                headers={
                    "X-Sandbox-ID": sandbox_id,
                    "X-Sandbox-Namespace": self.__namespace,
                    "X-Sandbox-Port": str(self.__server_port),
                },
            )
            response.raise_for_status()
            
            data = response.json()
            return SandboxCommandOutput(
                stdout=data.get("stdout", ""),
                stderr=data.get("stderr", ""),
                exit_code=data.get("exit_code", 0),
            )
        except Exception as e:
            logger.error(f"Failed to execute command in sandbox {sandbox_id}: {e}")
            return SandboxCommandOutput(
                stdout="",
                stderr=str(e),
                exit_code=1,
            )
    
    async def download_file(
        self, sandbox_id: str, from_sandbox_file: str, download_to_s3_key: str
    ) -> bool:
        """Download a file from sandbox and upload to S3."""
        try:
            # Download file from sandbox via router
            response = await self.__http_client.get(
                f"{self.__router_url}/download/{from_sandbox_file}",
                headers={
                    "X-Sandbox-ID": sandbox_id,
                    "X-Sandbox-Namespace": self.__namespace,
                    "X-Sandbox-Port": str(self.__server_port),
                },
            )
            response.raise_for_status()
            
            content = response.content
            
            # Upload to S3
            await S3_CLIENT.upload_object(
                key=download_to_s3_key,
                data=content,
            )
            
            logger.info(
                f"Downloaded file from sandbox {sandbox_id}: {from_sandbox_file} -> s3://{download_to_s3_key}"
            )
            return True
        except Exception as e:
            logger.error(
                f"Failed to download file from sandbox {sandbox_id}: {from_sandbox_file} -> {download_to_s3_key}, error: {e}"
            )
            return False
    
    async def upload_file(
        self, sandbox_id: str, from_s3_key: str, upload_to_sandbox_file: str
    ) -> bool:
        """Download from S3 and upload to sandbox."""
        try:
            # Download from S3
            content = await S3_CLIENT.download_object(key=from_s3_key)
            
            # Upload to sandbox via router
            filename = os.path.basename(upload_to_sandbox_file)
            files = {"file": (filename, content)}
            
            response = await self.__http_client.post(
                f"{self.__router_url}/upload",
                files=files,
                headers={
                    "X-Sandbox-ID": sandbox_id,
                    "X-Sandbox-Namespace": self.__namespace,
                    "X-Sandbox-Port": str(self.__server_port),
                },
            )
            response.raise_for_status()
            
            logger.info(
                f"Uploaded file to sandbox {sandbox_id}: s3://{from_s3_key} -> {upload_to_sandbox_file}"
            )
            return True
        except Exception as e:
            logger.error(
                f"Failed to upload file to sandbox {sandbox_id}: {from_s3_key} -> {upload_to_sandbox_file}, error: {e}"
            )
            return False
