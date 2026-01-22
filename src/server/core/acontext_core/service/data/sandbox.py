import asyncio
from sqlalchemy import select, update, type_coerce, func, extract, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import JSONB
from ...schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
)
from ...schema.result import Result
from ...schema.orm import SandboxLog
from ...schema.utils import asUUID
from ...infra.sandbox.client import SANDBOX_CLIENT
from ...env import LOG, DEFAULT_CORE_CONFIG
from ...constants import MetricTags
from ...telemetry.capture_metrics import capture_increment


async def _update_will_total_alive_seconds(
    db_session: AsyncSession,
    sandbox_id: asUUID,
    reset_alive_seconds: int = DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
) -> None:
    """
    Update the will_total_alive_seconds field based on how long the sandbox has been alive.
    Formula: DEFAULT_KEEPALIVE_SECONDS + (current_time - created_at)
    
    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).
        reset_alive_seconds: The reset alive seconds value.
    """
    # Get the old value and project_id for metric recording
    sandbox_log = await db_session.get(SandboxLog, sandbox_id)
    if not sandbox_log:
        return
    
    old_will_total_alive_seconds = sandbox_log.will_total_alive_seconds
    project_id = sandbox_log.project_id

    # Calculate and update the new value
    stmt = (
        update(SandboxLog)
        .where(SandboxLog.id == sandbox_id)
        .values(
            will_total_alive_seconds=reset_alive_seconds
            + func.cast(extract("epoch", func.now() - SandboxLog.created_at), Integer)
        )
    )
    await db_session.execute(stmt)

    # Record metric for the change
    await db_session.flush()
    updated_sandbox_log = await db_session.get(SandboxLog, sandbox_id)
    if updated_sandbox_log:
        new_will_total_alive_seconds = updated_sandbox_log.will_total_alive_seconds
        # Calculate the difference (can be negative for kill, positive for keepalive)
        increment_seconds = new_will_total_alive_seconds - old_will_total_alive_seconds
        
        # Only record if there's a meaningful change
        if increment_seconds != 0:
            asyncio.create_task(
                capture_increment(
                    project_id=project_id,
                    tag=MetricTags.new_sandbox_alive,
                    increment=increment_seconds,
                )
            )


async def _get_backend_sandbox_id(
    db_session: AsyncSession, sandbox_id: asUUID
) -> Result[str]:
    """
    Get the backend sandbox ID by unified sandbox ID.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).

    Returns:
        Result containing the backend sandbox ID string.
    """
    stmt = select(SandboxLog.backend_sandbox_id).where(SandboxLog.id == sandbox_id)
    result = await db_session.execute(stmt)
    backend_id = result.scalar_one_or_none()
    if backend_id is None:
        return Result.reject(f"Sandbox {sandbox_id} not found or was killed.")
    return Result.resolve(backend_id)


async def create_sandbox(
    db_session: AsyncSession,
    project_id: asUUID,
    config: SandboxCreateConfig,
) -> Result[SandboxRuntimeInfo]:
    """
    Create and start a new sandbox, storing the ID mapping in the database.

    Args:
        db_session: Database session.
        project_id: The project ID to associate the sandbox with.
        config: Configuration for the sandbox including timeout, CPU, memory, etc.

    Returns:
        Result containing runtime information with the unified sandbox ID.
    """
    try:
        backend = SANDBOX_CLIENT.use_backend()

        # Create the sandbox in the backend
        info = await backend.start_sandbox(config)

        # Create the SandboxLog record to store the ID mapping
        sandbox_log = SandboxLog(
            project_id=project_id,
            backend_sandbox_id=info.sandbox_id,
            backend_type=backend.type,
            history_commands=[],
            generated_files=[],
            will_total_alive_seconds=DEFAULT_CORE_CONFIG.sandbox_default_keepalive_seconds,
        )
        db_session.add(sandbox_log)
        await db_session.flush()

        LOG.debug(
            f"Created sandbox {sandbox_log.id} -> backend {backend.type}:{info.sandbox_id}"
        )

        # Replace the backend sandbox ID with the unified ID
        info.sandbox_id = str(sandbox_log.id)
        return Result.resolve(info)
    except ValueError as e:
        return Result.reject(f"Sandbox backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to create sandbox: {e}")
        return Result.reject(f"Failed to create sandbox: {e}")


async def kill_sandbox(db_session: AsyncSession, sandbox_id: asUUID) -> Result[bool]:
    """
    Kill a running sandbox.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).

    Returns:
        Result containing True if the sandbox was killed successfully.
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        success = await backend.kill_sandbox(backend_sandbox_id)

        # Set backend_sandbox_id to None to indicate the sandbox is killed
        stmt = (
            update(SandboxLog)
            .where(SandboxLog.id == sandbox_id)
            .values(backend_sandbox_id=None)
        )
        await db_session.execute(stmt)

        LOG.info(f"Killed sandbox {sandbox_id} (backend: {backend_sandbox_id})")
        await _update_will_total_alive_seconds(
            db_session, sandbox_id, reset_alive_seconds=0
        )
        return Result.resolve(success)
    except ValueError as e:
        return Result.reject(f"Sandbox backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to kill sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to kill sandbox: {e}")


async def get_sandbox(
    db_session: AsyncSession, sandbox_id: asUUID
) -> Result[SandboxRuntimeInfo]:
    """
    Get runtime information about a sandbox.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).

    Returns:
        Result containing runtime information about the sandbox.
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        info = await backend.get_sandbox(backend_sandbox_id)

        # Update will_total_alive_seconds
        await _update_will_total_alive_seconds(db_session, sandbox_id)

        # Replace the backend sandbox ID with the unified ID
        info.sandbox_id = str(sandbox_id)
        return Result.resolve(info)
    except ValueError as e:
        return Result.reject(f"Sandbox not found or backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to get sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to get sandbox: {e}")


async def update_sandbox(
    db_session: AsyncSession,
    sandbox_id: asUUID,
    config: SandboxUpdateConfig,
) -> Result[SandboxRuntimeInfo]:
    """
    Update sandbox configuration (e.g., extend timeout).

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).
        config: Update configuration (e.g., keepalive extension).

    Returns:
        Result containing runtime information about the updated sandbox.
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        info = await backend.update_sandbox(backend_sandbox_id, config)

        # Update will_total_alive_seconds
        await _update_will_total_alive_seconds(
            db_session, sandbox_id, config.keepalive_longer_by_seconds
        )

        # Replace the backend sandbox ID with the unified ID
        info.sandbox_id = str(sandbox_id)

        return Result.resolve(info)
    except ValueError as e:
        return Result.reject(f"Sandbox not found or backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to update sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to update sandbox: {e}")


async def exec_command(
    db_session: AsyncSession,
    sandbox_id: asUUID,
    command: str,
) -> Result[SandboxCommandOutput]:
    """
    Execute a shell command in the sandbox.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).
        command: The shell command to execute.

    Returns:
        Result containing the command output (stdout, stderr, exit_code).
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        output = await backend.exec_command(backend_sandbox_id, command)

        # Append to history_commands using PostgreSQL JSONB || operator
        # Use COALESCE to handle NULL values
        new_entry = [{"command": command, "exit_code": output.exit_code}]
        stmt = (
            update(SandboxLog)
            .where(SandboxLog.id == sandbox_id)
            .values(
                history_commands=func.coalesce(
                    SandboxLog.history_commands, type_coerce([], JSONB)
                )
                + type_coerce(new_entry, JSONB)
            )
        )
        await db_session.execute(stmt)

        # Update will_total_alive_seconds
        await _update_will_total_alive_seconds(db_session, sandbox_id)

        return Result.resolve(output)
    except ValueError as e:
        return Result.reject(f"Sandbox not found or backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to execute command in sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to execute command: {e}")


async def download_file(
    db_session: AsyncSession,
    sandbox_id: asUUID,
    from_sandbox_file: str,
    download_to_s3_key: str,
) -> Result[bool]:
    """
    Download a file from the sandbox and upload it to S3.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).
        from_sandbox_file: The path to the file in the sandbox.
        download_to_s3_key: The full S3 key (path) to upload the file to.

    Returns:
        Result containing True if the file was transferred successfully.
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        success = await backend.download_file(
            backend_sandbox_id, from_sandbox_file, download_to_s3_key
        )

        if success:
            # Append to generated_files using PostgreSQL JSONB || operator
            # Use COALESCE to handle NULL values
            new_entry = [{"sandbox_path": from_sandbox_file}]
            stmt = (
                update(SandboxLog)
                .where(SandboxLog.id == sandbox_id)
                .values(
                    generated_files=func.coalesce(
                        SandboxLog.generated_files, type_coerce([], JSONB)
                    )
                    + type_coerce(new_entry, JSONB)
                )
            )
            await db_session.execute(stmt)

        # Update will_total_alive_seconds
        await _update_will_total_alive_seconds(db_session, sandbox_id)

        return Result.resolve(success)
    except ValueError as e:
        return Result.reject(f"Sandbox not found or backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to download file from sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to download file: {e}")


async def upload_file(
    db_session: AsyncSession,
    sandbox_id: asUUID,
    from_s3_key: str,
    upload_to_sandbox_file: str,
) -> Result[bool]:
    """
    Download a file from S3 and upload it to the sandbox.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).
        from_s3_key: The S3 key of the file to download.
        upload_to_sandbox_file: The full path in the sandbox to upload the file to.

    Returns:
        Result containing True if the file was transferred successfully.
    """
    try:
        # Look up the backend sandbox ID
        result = await _get_backend_sandbox_id(db_session, sandbox_id)
        if not result.ok():
            return Result.reject(result.error.errmsg)

        backend_sandbox_id = result.data
        backend = SANDBOX_CLIENT.use_backend()
        success = await backend.upload_file(
            backend_sandbox_id, from_s3_key, upload_to_sandbox_file
        )

        # Update will_total_alive_seconds
        await _update_will_total_alive_seconds(db_session, sandbox_id)

        return Result.resolve(success)
    except ValueError as e:
        return Result.reject(f"Sandbox not found or backend not available: {e}")
    except Exception as e:
        LOG.error(f"Failed to upload file to sandbox {sandbox_id}: {e}")
        return Result.reject(f"Failed to upload file: {e}")


async def get_sandbox_log(
    db_session: AsyncSession, sandbox_id: asUUID
) -> Result[SandboxLog]:
    """
    Get the full SandboxLog record by unified sandbox ID.

    Args:
        db_session: Database session.
        sandbox_id: The unified sandbox ID (UUID).

    Returns:
        Result containing the SandboxLog record.
    """
    sandbox_log = await db_session.get(SandboxLog, sandbox_id)
    if sandbox_log is None:
        return Result.reject(f"Sandbox {sandbox_id} not found")

    # Update will_total_alive_seconds
    await _update_will_total_alive_seconds(db_session, sandbox_id)

    return Result.resolve(sandbox_log)


async def list_project_sandboxes(
    db_session: AsyncSession, project_id: asUUID
) -> Result[list[SandboxLog]]:
    """
    List all sandboxes for a project.

    Args:
        db_session: Database session.
        project_id: The project ID.

    Returns:
        Result containing a list of SandboxLog records.
    """
    try:
        query = select(SandboxLog).where(SandboxLog.project_id == project_id)
        result = await db_session.execute(query)
        sandbox_logs = list(result.scalars().all())
        return Result.resolve(sandbox_logs)
    except Exception as e:
        LOG.error(f"Failed to list sandboxes for project {project_id}: {e}")
        return Result.reject(f"Failed to list sandboxes: {e}")
