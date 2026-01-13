import os
from datetime import datetime, timedelta, timezone
from typing import Type, Optional, Dict
from bedrock_agentcore.tools.code_interpreter_client import CodeInterpreter

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


class AWSAgentCoreSandboxBackend(SandboxBackend):
    """AWS Bedrock AgentCore Sandbox Backend.

    This backend manages code interpreter sessions through AWS Bedrock AgentCore,
    providing secure isolated environments for code execution with AWS managed infrastructure.
    """

    type: str = "aws_agentcore"

    def __init__(
        self,
        region: str,
    ):
        """Initialize the AWS AgentCore sandbox backend.

        Args:
            region: AWS region (e.g., "us-west-2")
        """
        self.__region = region
        # Track active sessions: sandbox_id -> CodeInterpreter client
        self.__clients: Dict[str, CodeInterpreter] = {}

    @classmethod
    def from_default(cls: Type["AWSAgentCoreSandboxBackend"]) -> "AWSAgentCoreSandboxBackend":
        """Create backend from default configuration."""
        if DEFAULT_CORE_CONFIG.aws_agentcore_region is None:
            raise ValueError("aws_agentcore_region must be configured for AWS AgentCore sandbox")
        return cls(
            region=DEFAULT_CORE_CONFIG.aws_agentcore_region,
        )

    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo:
        """Create and start a new AWS AgentCore session.

        Args:
            create_config: Configuration for the sandbox (keepalive is managed by AWS)

        Returns:
            Runtime information about the created session.
        """
        # Create a new client for this session
        client = CodeInterpreter(self.__region)
        
        # Start the session with the configured timeout
        client.start(session_timeout_seconds=create_config.keepalive_seconds)
        
        # Get the session ID
        session_id = client.session_id
        
        if not session_id:
            raise ValueError("Failed to start AWS AgentCore session: no session_id returned")
        
        # Store the client
        self.__clients[session_id] = client
        
        logger.info(f"Started AWS AgentCore session: {session_id}")
        
        # Get session info to return accurate data
        session_info = client.get_session(session_id=session_id)
        
        # Parse timestamps
        created_at = session_info.get("createdAt")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        else:
            raise ValueError("Failed to get createdAt from session info")
        
        # Calculate expiration time
        timeout_seconds = session_info.get("sessionTimeoutSeconds", create_config.keepalive_seconds)
        expires_at = created_at + timedelta(seconds=timeout_seconds)
        
        return SandboxRuntimeInfo(
            sandbox_id=session_id,
            sandbox_status=SandboxStatus.RUNNING,
            sandbox_created_at=created_at,
            sandbox_expires_at=expires_at,
        )

    async def kill_sandbox(self, sandbox_id: str) -> bool:
        """Stop an AWS AgentCore session.

        Args:
            sandbox_id: The session ID to stop

        Returns:
            True if successfully stopped
        """
        if sandbox_id not in self.__clients:
            logger.warning(f"Session {sandbox_id} not found in active clients")
            return False
        
        try:
            client = self.__clients[sandbox_id]
            
            # Stop the session
            client.stop()
            
            # Remove from tracking
            del self.__clients[sandbox_id]
            
            logger.info(f"Stopped AWS AgentCore session: {sandbox_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop session {sandbox_id}: {e}")
            # Remove from tracking even if stop fails
            if sandbox_id in self.__clients:
                del self.__clients[sandbox_id]
            return False

    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo:
        """Get runtime information about a session.

        Args:
            sandbox_id: The session ID to query

        Returns:
            Runtime information including status and timestamps

        Raises:
            ValueError: If the session is not found
        """
        if sandbox_id not in self.__clients:
            raise ValueError(f"Session {sandbox_id} not found in active clients")
        
        try:
            client = self.__clients[sandbox_id]
            
            # Get actual session info from AWS
            session_info = client.get_session(session_id=sandbox_id)
            
            # Parse status
            aws_status = session_info.get("status", "READY")
            if aws_status == "READY":
                status = SandboxStatus.RUNNING
            elif aws_status == "TERMINATED":
                status = SandboxStatus.SUCCESS
            else:
                status = SandboxStatus.ERROR
            
            # Parse timestamps
            created_at = session_info.get("createdAt")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            else:
                raise ValueError("Failed to get createdAt from session info")
            
            # Calculate expiration time
            timeout_seconds = session_info.get("sessionTimeoutSeconds")
            if timeout_seconds is None:
                raise ValueError("Failed to get sessionTimeoutSeconds from session info")
            expires_at = created_at + timedelta(seconds=timeout_seconds)
            
            return SandboxRuntimeInfo(
                sandbox_id=sandbox_id,
                sandbox_status=status,
                sandbox_created_at=created_at,
                sandbox_expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to get session info for {sandbox_id}: {e}")
            raise ValueError(f"Failed to get session {sandbox_id}: {e}")

    async def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo:
        """Update sandbox configuration.

        Note: AWS AgentCore doesn't support extending session timeout after creation.
        This method is a no-op and returns current session info.

        Args:
            sandbox_id: The session ID
            update_config: Update configuration (ignored)

        Returns:
            Current runtime information
        """
        logger.warning(
            f"AWS AgentCore doesn't support timeout updates. "
            f"Ignoring update request for session {sandbox_id}"
        )
        return await self.get_sandbox(sandbox_id)

    async def exec_command(
        self, sandbox_id: str, command: str
    ) -> SandboxCommandOutput:
        """Execute a shell command in the session.

        Args:
            sandbox_id: The session ID
            command: The shell command to execute

        Returns:
            Command output including stdout, stderr, and exit code
        """
        if sandbox_id not in self.__clients:
            raise ValueError(f"Session {sandbox_id} not found in active clients")
        
        try:
            client = self.__clients[sandbox_id]
            
            # Execute command and get result
            # Response: {'sessionId': str, 'stream': EventStream}
            result = client.execute_command(command)
            
            stdout = ""
            stderr = ""
            exit_code = 0
            
            # Process the event stream
            if "stream" in result:
                for event in result["stream"]:
                    # Handle result event
                    if "result" in event:
                        result_data = event["result"]
                        
                        # Check if this is an error result
                        is_error = result_data.get("isError", False)
                        
                        # Priority 1: Use structuredContent if available (has stdout/stderr/exitCode)
                        if "structuredContent" in result_data:
                            structured = result_data["structuredContent"]
                            stdout += structured.get("stdout", "")
                            stderr += structured.get("stderr", "")
                            exit_code = structured.get("exitCode", 1 if is_error else 0)
                        
                        # Priority 2: Parse content array
                        elif "content" in result_data:
                            for content_item in result_data["content"]:
                                content_type = content_item.get("type")
                                
                                # Text content
                                if content_type == "text" and "text" in content_item:
                                    text = content_item["text"]
                                    if is_error:
                                        stderr += text
                                    else:
                                        stdout += text
                                
                                # Resource content
                                elif content_type == "resource" and "resource" in content_item:
                                    resource = content_item["resource"]
                                    if resource.get("type") == "text" and "text" in resource:
                                        stdout += resource["text"]
                                    elif resource.get("type") == "blob" and "blob" in resource:
                                        blob_data = resource["blob"]
                                        if isinstance(blob_data, bytes):
                                            stdout += blob_data.decode("utf-8", errors="replace")
                            
                            if is_error:
                                exit_code = 1
                    
                    # Handle various exception types
                    elif any(exc in event for exc in [
                        "accessDeniedException", "conflictException", "internalServerException",
                        "resourceNotFoundException", "serviceQuotaExceededException",
                        "throttlingException", "validationException"
                    ]):
                        # Find which exception it is
                        for exc_type in event:
                            if exc_type.endswith("Exception"):
                                exc_data = event[exc_type]
                                stderr = f"[{exc_type}] {exc_data.get('message', 'Unknown error')}"
                                exit_code = 1
                                break
            
            return SandboxCommandOutput(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
            )
        except Exception as e:
            logger.error(f"Failed to execute command in session {sandbox_id}: {e}")
            return SandboxCommandOutput(
                stdout="",
                stderr=str(e),
                exit_code=1,
            )

    async def download_file(
        self, sandbox_id: str, from_sandbox_file: str, download_to_s3_path: str
    ) -> bool:
        """Download a file from the session and upload it to S3.

        Args:
            sandbox_id: The session ID
            from_sandbox_file: Path to the file in the session
            download_to_s3_path: S3 parent directory to upload to

        Returns:
            True if successful
        """
        if sandbox_id not in self.__clients:
            logger.error(f"Session {sandbox_id} not found in active clients")
            return False
        
        try:
            client = self.__clients[sandbox_id]
            
            # Download file from session
            content = client.download_file(from_sandbox_file)
            
            # Convert to bytes if necessary
            if isinstance(content, str):
                content_bytes = content.encode("utf-8")
            else:
                content_bytes = content
            
            # Construct S3 key
            filename = os.path.basename(from_sandbox_file)
            s3_key = f"{download_to_s3_path.rstrip('/')}/{filename}"
            
            # Upload to S3
            await S3_CLIENT.upload_object(
                key=s3_key,
                data=content_bytes,
            )
            
            logger.info(
                f"Downloaded file from session {sandbox_id}: {from_sandbox_file} -> s3://{s3_key}"
            )
            return True
        
        except Exception as e:
            logger.error(
                f"Failed to download file from session {sandbox_id}: "
                f"{from_sandbox_file} -> {download_to_s3_path}, error: {e}"
            )
            return False

    async def upload_file(
        self, sandbox_id: str, from_s3_file: str, upload_to_sandbox_path: str
    ) -> bool:
        """Download a file from S3 and upload it to the session.

        Args:
            sandbox_id: The session ID
            from_s3_file: S3 key to download from
            upload_to_sandbox_path: Parent directory in the session

        Returns:
            True if successful
        """
        if sandbox_id not in self.__clients:
            logger.error(f"Session {sandbox_id} not found in active clients")
            return False
        
        try:
            client = self.__clients[sandbox_id]
            
            # Download from S3
            content = await S3_CLIENT.download_object(key=from_s3_file)
            
            # Construct session file path
            filename = os.path.basename(from_s3_file)
            session_file_path = f"{upload_to_sandbox_path.rstrip('/')}/{filename}"
            
            # Upload to session
            # Use upload_file which takes path, content, and optional description
            client.upload_file(
                path=session_file_path,
                content=content,
                description=f"Uploaded from S3: {from_s3_file}"
            )
            
            logger.info(
                f"Uploaded file to session {sandbox_id}: s3://{from_s3_file} -> {session_file_path}"
            )
            return True
        
        except Exception as e:
            logger.error(
                f"Failed to upload file to session {sandbox_id}: "
                f"{from_s3_file} -> {upload_to_sandbox_path}, error: {e}"
            )
            return False

