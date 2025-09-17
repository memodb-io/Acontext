

## Local Development

- Start infras

```bash
# current path: ./src/server
sh scripts/local_dev_deps.sh
```

- Setup python deps

```bash
# current path: ./src/server/core
uv sync
```

- Launch Core in dev mode (with hot reload)

```bash
# current path: ./src/server/core
sh launch.sh
```

- Launch Core in prod mode

```bash
# current path: ./src/server/core
sh launch.sh -m prod
sh launch.sh -m prod -w 4 # 4 workers
```

- Test the core
```bash
# current path: ./src/server/core
cp config.yaml.example config.yaml
uv run -m pytest
```