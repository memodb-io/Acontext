# Cloudflare Sandbox Worker API

HTTP API proxy for Cloudflare Sandbox SDK, enabling Python Core to interact with Cloudflare Sandbox via REST endpoints.

## Overview

This Worker acts as a bridge between the Python `acontext_core` module and the Cloudflare Sandbox SDK. It exposes a RESTful API that maps to all Sandbox SDK operations.

## Architecture

```
Python Core → CloudflareSandboxBackend → HTTP API → Cloudflare Worker → Sandbox SDK
```

## API Endpoints

All endpoints accept JSON requests and return JSON responses.

### Create Sandbox

```bash
POST /sandbox/create
Content-Type: application/json

{
  "sandbox_id": "my-sandbox-id",
  "keepalive_seconds": 1800,  # Optional
  "additional_configs": {}    # Optional
}
```

Response:
```json
{
  "sandbox_id": "my-sandbox-id",
  "sandbox_status": "running",
  "sandbox_created_at": "2025-01-15T10:00:00.000Z",
  "sandbox_expires_at": "2025-01-15T10:30:00.000Z"
}
```

### Kill Sandbox

```bash
POST /sandbox/{sandbox_id}/kill
```

Response:
```json
{
  "success": true
}
```

### Get Sandbox Info

```bash
GET /sandbox/{sandbox_id}
```

Response:
```json
{
  "sandbox_id": "my-sandbox-id",
  "sandbox_status": "running",
  "sandbox_created_at": "2025-01-15T10:00:00.000Z",
  "sandbox_expires_at": null
}
```

### Update Sandbox

```bash
POST /sandbox/{sandbox_id}/update
Content-Type: application/json

{
  "keepalive_longer_by_seconds": 600
}
```

Response:
```json
{
  "sandbox_id": "my-sandbox-id",
  "sandbox_status": "running",
  "sandbox_created_at": "2025-01-15T10:00:00.000Z",
  "sandbox_expires_at": "2025-01-15T10:40:00.000Z"
}
```

### Execute Command

```bash
POST /sandbox/{sandbox_id}/exec
Content-Type: application/json

{
  "command": "python --version"
}
```

Response:
```json
{
  "stdout": "Python 3.11.14\n",
  "stderr": "",
  "exit_code": 0
}
```

### Download File

```bash
POST /sandbox/{sandbox_id}/download
Content-Type: application/json

{
  "file_path": "/workspace/example.txt",
  "encoding": "base64"  # Optional: "utf-8" or "base64"
}
```

Response:
```json
{
  "content": "SGVsbG8gV29ybGQ=",  # Base64 encoded
  "encoding": "base64"
}
```

### Upload File

```bash
POST /sandbox/{sandbox_id}/upload
Content-Type: application/json

{
  "file_path": "/workspace/example.txt",
  "content": "SGVsbG8gV29ybGQ=",  # Base64 encoded
  "encoding": "base64"  # Optional: "utf-8" or "base64"
}
```

Response:
```json
{
  "success": true
}
```

## Authentication

The Worker supports optional Bearer token authentication. To enable:

1. Set the `AUTH_TOKEN` secret in Wrangler:
   ```bash
   npx wrangler secret put AUTH_TOKEN
   ```

2. Include the token in requests:
   ```bash
   Authorization: Bearer <your-token>
   ```

If `AUTH_TOKEN` is not set, the Worker accepts all requests without authentication.

## Local Development

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Docker (required for building container images)

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm run dev
   ```

The Worker will be available at `http://localhost:8787`.

**Note**: First run will build the Docker container (2-3 minutes). Subsequent runs are much faster due to caching.

### Testing

```bash
# Test create sandbox
curl -X POST http://localhost:8787/sandbox/create \
  -H "Content-Type: application/json" \
  -d '{"sandbox_id": "test-123"}'

# Test execute command
curl -X POST http://localhost:8787/sandbox/test-123/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "echo hello"}'
```

## Production Deployment

### Deploy to Cloudflare Workers

```bash
npx wrangler deploy
```

### Set Secrets (if using authentication)

```bash
npx wrangler secret put AUTH_TOKEN
```

### After Deployment

Wait 2-3 minutes for container provisioning before making requests. Check status:

```bash
npx wrangler containers list
```

### Worker URL

After deployment, you'll receive a Worker URL like:
```
https://cloudflare.your-subdomain.workers.dev
```

Use this URL in your Python Core configuration (`cloudflare_worker_url`).

## Configuration

### Wrangler Configuration

The `wrangler.jsonc` file is already configured with:

- Container binding to `Sandbox` Durable Object
- Dockerfile path (`./Dockerfile`)
- Instance type (`lite`)
- Max instances (`1`)

### Dockerfile

The `Dockerfile` is based on `docker.io/cloudflare/sandbox:0.3.3`.

**Version Matching**: Ensure `package.json` has `@cloudflare/sandbox@^0.3.3` to match the Dockerfile version.

## Integration with Python Core

### Configuration

In `config.yaml` or environment variables:

```yaml
sandbox_type: "cloudflare"
cloudflare_worker_url: "http://localhost:8787"  # Local dev
# cloudflare_worker_url: "https://cloudflare.your-subdomain.workers.dev"  # Production
cloudflare_worker_auth_token: "your-token"  # Optional
```

### Usage

The Python `CloudflareSandboxBackend` will automatically use this Worker API for all sandbox operations.

## Troubleshooting

### Container Not Ready

After first deployment, wait 2-3 minutes for container provisioning. Check logs:

```bash
npx wrangler tail
```

### Authentication Errors

If you get `401 Unauthorized`, ensure:

1. `AUTH_TOKEN` is set as a Wrangler secret
2. Requests include `Authorization: Bearer <token>` header
3. Token matches exactly

### Connection Refused (Local Dev)

Ensure:

1. Docker is running
2. `pnpm run dev` is active
3. Python Core is configured with `http://localhost:8787`

## Related Documentation

- [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
