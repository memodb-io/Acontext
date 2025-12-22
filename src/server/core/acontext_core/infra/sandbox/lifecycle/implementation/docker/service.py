import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from ...base import SandboxService, SandboxSpecService
from ...enums import SandboxBackend, SandboxStatus
from ...models import SandboxInfo, SandboxPage
from .models import DockerRunOptions
from .spec import DockerSandboxSpecInfo


import docker  # type: ignore



@dataclass
class DockerSandboxService(SandboxService):
    """Docker backend implementation with the same public interface as Cloudflare."""

    spec_service: SandboxSpecService
    base_name_prefix: str = "acontext-docker-sandbox"
    # Optional ID of the user who owns sandboxes started via this service instance.
    # This mirrors CloudflareSandboxService.user_id so higher layers can treat
    # different backends consistently.
    user_id: Optional[str] = None

    _client: Optional["docker.DockerClient"] = field(default=None, init=False)  # type: ignore[name-defined]

    # -------------------------- internal helpers -------------------------- #

    def _require_docker(self) -> None:
        if docker is None:
            raise RuntimeError(
                "docker SDK is required for DockerSandboxService. "
                "Install it with: pip install docker"
            )

    def _get_client(self) -> "docker.DockerClient":  # type: ignore[name-defined]
        self._require_docker()
        if self._client is None:
            self._client = docker.from_env()  # type: ignore[operator]
        return self._client

    def _parse_label_created(self, value: Optional[str]) -> Optional[datetime]:
        """
        Parse our own acontext-created timestamp stored in labels, e.g.:
        labels["acontext.createdAt"] = datetime.utcnow().isoformat()
        """
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    async def _run_in_thread(self, func, *args, **kwargs):
        # Use asyncio.to_thread (Python 3.9+) instead of manual run_in_executor.
        return await asyncio.to_thread(func, *args, **kwargs)

    # -------------------------- query APIs -------------------------- #

    async def search_sandboxes(
        self, page_id: Optional[str] = None, limit: int = 100
    ) -> SandboxPage:
        """List Docker containers created by this service as sandbox instances."""

        def _list() -> SandboxPage:
            client = self._get_client()
            # Only list containers with our sandbox labels.
            # If user_id is set on this service, further restrict to containers
            # belonging to that user so each user only sees their own sandboxes.
            label_filters: list[str] = ["acontext.sandbox=true"]
            if self.user_id is not None:
                label_filters.append(f"acontext.userId={self.user_id}")
            containers = client.containers.list(
                all=True,
                filters={
                    "label": label_filters,
                },
            )
            items: list[SandboxInfo] = []
            for c in containers[:limit]:
                labels = c.labels or {}
                # Require essential labels; skip containers without them
                sandbox_id = labels.get("acontext.sandboxId")
                spec_id = labels.get("acontext.sandboxSpecId")
                if not sandbox_id or not spec_id:
                    continue
                
                status = (
                    SandboxStatus.PAUSED
                    if c.status == "paused"
                    else SandboxStatus.RUNNING
                )

                # Use the acontext-managed timestamp stored in labels["acontext.createdAt"].
                # If it is missing or cannot be parsed, skip this container.
                created_at = self._parse_label_created(labels.get("acontext.createdAt"))
                if created_at is None:
                    continue
                
                info = SandboxInfo(
                    id=sandbox_id,
                    sandbox_spec_id=spec_id,
                    backend=SandboxBackend.DOCKER,
                    status=status,
                    created_at=created_at,
                )
                items.append(info)
            return SandboxPage(items=items, next_page_id=None)

        return await self._run_in_thread(_list)

    async def _find_container_by_sandbox_id(self, sandbox_id: str):
        """Return the Docker container instance for the given sandbox_id, if any."""
        def _find():
            client = self._get_client()
            containers = client.containers.list(
                all=True, filters={"label": f"acontext.sandboxId={sandbox_id}"}
            )
            return containers[0] if containers else None

        return await self._run_in_thread(_find)

    async def get_sandbox(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """Look up a sandbox container in Docker by its sandbox_id."""

        container = await self._find_container_by_sandbox_id(sandbox_id)
        if not container:
            return None

        labels = container.labels or {}
        spec_id = labels.get("acontext.sandboxSpecId")
        if not spec_id:
            return None
        
        status = (
            SandboxStatus.PAUSED
            if container.status == "paused"
            else SandboxStatus.RUNNING
        )
        # Only trust the timestamp we stored in labels["acontext.createdAt"].
        # If it is missing or invalid, treat the container as not a valid sandbox.
        created_at = self._parse_label_created(labels.get("acontext.createdAt"))
        if created_at is None:
            return None

        return SandboxInfo(
            id=sandbox_id,
            sandbox_spec_id=spec_id,
            backend=SandboxBackend.DOCKER,
            status=status,
            created_at=created_at,
        )

    # -------------------------- lifecycle APIs -------------------------- #

    async def start_sandbox(self, sandbox_spec_id: Optional[str] = None) -> SandboxInfo:
        """Start a new Docker sandbox container from a given spec."""

        async def _get_spec() -> DockerSandboxSpecInfo:
            spec = (
                await self.spec_service.get_sandbox_spec(sandbox_spec_id)
                if sandbox_spec_id
                else await self.spec_service.get_default_sandbox_spec()
            )
            if not isinstance(spec, DockerSandboxSpecInfo):
                raise TypeError(
                    f"Expected DockerSandboxSpecInfo, got {type(spec).__name__}"
                )
            return spec

        spec = await _get_spec()

        # Generate sandbox_id and container name
        sandbox_id = f"docker-sandbox-{uuid.uuid4().hex[:16]}"
        container_name = f"{self.base_name_prefix}-{sandbox_id}"

        def _start() -> SandboxInfo:
            # Let acontext decide the sandbox creation time and persist it in labels
            # so later queries can rely on a single, consistent source of truth.
            created_at = datetime.utcnow()

            client = self._get_client()

            labels = dict(spec.labels or {})
            labels.update(
                {
                    # Mark this container as managed by acontext so we can filter it later.
                    "acontext.sandbox": "true",
                    # Indicate the backend is Docker (as opposed to other runtimes).
                    "acontext.backend": "docker",
                    # Store the logical sandbox id (distinct from the Docker container id).
                    "acontext.sandboxId": sandbox_id,
                    # Store the sandbox spec id used to create this container.
                    "acontext.sandboxSpecId": spec.id,
                }
            )
            # Persist the sandbox creation time in labels as the single source of truth.
            labels["acontext.createdAt"] = created_at.isoformat()
            # Attach user ownership info if available so we can later filter
            if self.user_id is not None:
                labels["acontext.userId"] = self.user_id

            options = DockerRunOptions(
                image=spec.image,
                name=container_name,
                labels=labels,
                command=spec.command,
                environment=spec.environment,
                ports=spec.ports,
                volumes=spec.volumes,
                mem_limit=spec.mem_limit,
                cpu_shares=spec.cpu_shares,
                cpuset_cpus=spec.cpuset_cpus,
                network=spec.network,
                restart_policy=spec.restart_policy,
            )

            container = client.containers.run(**options.to_docker_kwargs())

            # Port discovery is not implemented yet. It can be added later by
            # inspecting container.attrs["NetworkSettings"].
            return SandboxInfo(
                id=sandbox_id,
                sandbox_spec_id=spec.id,
                backend=SandboxBackend.DOCKER,
                status=SandboxStatus.RUNNING,
                exposed_urls=None,  # type: ignore[arg-type]
                created_at=created_at,
            )

        return await self._run_in_thread(_start)

    async def pause_sandbox(self, sandbox_id: str) -> bool:
        async def _pause() -> bool:
            container = await self._find_container_by_sandbox_id(sandbox_id)
            if not container:
                return False
            # Freeze all processes inside the container (0% CPU usage);
            # memory and network resources remain allocated.
            container.pause()
            return True

        return await _pause()

    async def resume_sandbox(self, sandbox_id: str) -> bool:
        async def _resume() -> bool:
            container = await self._find_container_by_sandbox_id(sandbox_id)
            if not container:
                return False
            # Unfreeze processes in the container and resume normal execution.
            container.unpause()
            return True

        return await _resume()

    async def delete_sandbox(self, sandbox_id: str) -> bool:
        async def _delete() -> bool:
            container = await self._find_container_by_sandbox_id(sandbox_id)
            if not container:
                return False
            try:
                container.stop(timeout=1)
                # Attempt to gracefully terminate all processes in the container by sending SIGTERM signal first.
                # If the processes fail to exit voluntarily within 1 second (timeout threshold),
                # force terminate them immediately with SIGKILL signal (equivalent to container.kill()).
            except Exception:
                # Container might have already stopped; ignore stop errors
                pass
            try:
                # Equivalent to `docker rm -fv <container>`: remove the container
                # along with its anonymous volumes, forcing removal if needed.
                container.remove(v=True, force=True)
            except Exception:
                return False
            return True

        return await _delete()
