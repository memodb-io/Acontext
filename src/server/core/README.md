

## Local Development

- Start Deps using docker compose

```bash
# current path: ./src/server
sh scripts/local_dev_deps.sh
```

- Setup python deps

```bash
# current path: ./src/server/core
uv sync
```

- Set necessary configs
```bash
cp config.yaml.example config.yaml
# or
cp .env.example .env
```
> Using `config.yaml` or `.env` to pass configs are identical, choose the one you like. 
> If an var is both in `config.yaml` and `.env`, the value of `config.yaml` will be used.


- Launch Core in dev mode (with hot reload)

```bash
# current path: ./src/server/core
uv run python -m acontext_core.infra.alembic upgrade-head
uv run -m fastapi dev
```

- Launch Core in prod mode

```bash
# current path: ./src/server/core
uv run python -m acontext_core.infra.alembic upgrade-head
uv run -m uvicorn api:app --host 0.0.0.0 --port 8000
```

- Existing database bootstrap

```bash
# current path: ./src/server/core
uv run python -m acontext_core.infra.alembic upgrade-head
```

If the database already has the old core tables but no Alembic history yet, the
migration runner stamps the baseline revision once and then upgrades to `head`.

- Service Healthcheck
```bash
curl http://localhost:8000/health
```

- Run Test
```bash
# current path: ./src/server/core
uv run -m pytest
```
