# Use Python slim image as base
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files
COPY ./pyproject.toml /app
COPY ./uv.lock /app

# Install Python dependencies using uv
RUN uv sync --frozen --no-dev --no-cache-dir

# Copy the application code
COPY ./acontext_core /app/acontext_core
COPY ./api.py /app

# Expose port 8000
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the FastAPI server using uvicorn
CMD ["/app/.venv/bin/uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "600"]
