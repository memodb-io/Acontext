# Acontext API

Go REST API server for the Acontext platform. Provides project, space, and session management with semantic search capabilities. Built with Gin, PostgreSQL, Redis, and RabbitMQ.

## Prerequisites

- Go 1.25.0+
- PostgreSQL, Redis, RabbitMQ
- S3-compatible storage (optional)

## Setup

1. **Environment**: Create `.env` in parent directory:
```bash
API_EXPORT_PORT=8029
ROOT_API_BEARER_TOKEN=your-root-token
DATABASE_HOST=127.0.0.1
DATABASE_USER=acontext
DATABASE_PASSWORD=your-password
DATABASE_NAME=acontext
DATABASE_EXPORT_PORT=5432
REDIS_HOST=127.0.0.1
REDIS_EXPORT_PORT=6379
REDIS_PASSWORD=your-redis-password
RABBITMQ_HOST=127.0.0.1
RABBITMQ_USER=acontext
RABBITMQ_PASSWORD=your-rabbitmq-password
RABBITMQ_EXPORT_PORT=5672
RABBITMQ_VHOST_ENCODED=acontext
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=acontext
```

2. **Install & Run**:
```bash
make run  # Installs tools, generates docs, runs server
```

Or manually:
```bash
cd go && go mod tidy && go run ./cmd/server
```

## Commands

- `make run` - Run development server
- `make swag` - Generate Swagger docs
- `make doctor` - Health check

## API

- **Base URL**: `http://localhost:8029/api/v1`
- **Swagger**: `http://localhost:8029/swagger/index.html`

### Authentication
- **Root**: `Authorization: Bearer your-root-api-bearer-token` (admin operations)
- **Project**: `Authorization: Bearer sk-proj-xxxx` (project operations)

### Main Endpoints
- `GET /health` - Health check
- `POST /api/v1/project` - Create project (root auth)
- `POST /api/v1/space` - Create space (project auth)
- `POST /api/v1/session` - Create session (project auth)
- `POST /api/v1/session/{id}/messages` - Store message (project auth)

## Deploy

The server auto-migrates database schema and runs on the configured port. Check logs for startup status and any errors.