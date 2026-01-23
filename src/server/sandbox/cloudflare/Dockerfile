FROM docker.io/cloudflare/sandbox:0.7.0-python

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    (command -v rg >/dev/null 2>&1 || apt-get install -y --no-install-recommends ripgrep) && \
    (command -v fd >/dev/null 2>&1 || command -v fdfind >/dev/null 2>&1 || apt-get install -y --no-install-recommends fd-find) && \
    (command -v sqlite3 >/dev/null 2>&1 || apt-get install -y --no-install-recommends sqlite3) && \
    (command -v jq >/dev/null 2>&1 || apt-get install -y --no-install-recommends jq) && \
    (command -v convert >/dev/null 2>&1 || apt-get install -y --no-install-recommends imagemagick) && \
    if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then \
        ln -s /usr/bin/fdfind /usr/local/bin/fd; \
    fi && \
    rm -rf /var/lib/apt/lists/*

# Optional: Install additional dependencies if needed
# RUN pip install ...
# RUN npm install -g ...

# Optional: Expose ports for local development if using exposePort()
# EXPOSE 8080
# EXPOSE 5173
