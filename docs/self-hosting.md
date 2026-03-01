# Self-Hosting CloakShare

CloakShare is fully self-hostable. This guide covers running CloakShare on your own infrastructure using Docker.

## Requirements

- Docker & Docker Compose
- 1GB RAM minimum (2GB recommended for video transcoding)
- S3-compatible storage (MinIO included, or use AWS S3, Backblaze B2, Cloudflare R2)

### Optional Dependencies

- **FFmpeg** — Required for video transcoding. Set `ENABLE_VIDEO=true` to enable.
- **LibreOffice** — Required for office document conversion (DOCX, PPTX, XLSX).
- **Poppler** — Required for PDF rendering (`pdftoppm`).

The Docker image includes all optional dependencies.

## Quick Start

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
cp .env.example .env
# Edit .env with your secrets (see below)
docker compose up -d
```

CloakShare is now running at `http://localhost:3000`.

## Configuration

Copy `.env.example` to `.env` and configure:

### Required Secrets

Generate secure random values for production:

```bash
# Generate secrets
openssl rand -hex 32  # Use output for each secret below
```

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Secret for session cookies. Must be unique, 32+ characters. |
| `JWT_SECRET` | Secret for JWT tokens. Must be unique, 32+ characters. |
| `CLOAK_SIGNING_SECRET` | Secret for URL signing. Must be unique, 32+ characters. |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Set to `production` for production deployments |
| `API_URL` | `http://localhost:3000` | Public API URL (used for signed URLs) |
| `VIEWER_URL` | `http://localhost:5173` | Public viewer URL |
| `DASHBOARD_URL` | `http://localhost:5174` | Public dashboard URL |
| `CLOAK_MODE` | `self-hosted` | Must be `self-hosted` |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PROVIDER` | `sqlite` | `sqlite` (self-hosted) or `turso` (cloud) |
| `SQLITE_PATH` | `./data/cloak.db` | Path to SQLite database file |

### Storage

CloakShare stores rendered page images and video segments. Choose a storage provider:

**Local filesystem (default):**

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_PROVIDER` | `local` | Use local filesystem |
| `STORAGE_LOCAL_PATH` | `./data/renders` | Directory for rendered files |

**S3-compatible storage:**

| Variable | Description |
|----------|-------------|
| `STORAGE_PROVIDER` | Set to `s3` |
| `S3_ENDPOINT` | S3 endpoint URL (e.g., `http://minio:9000`) |
| `S3_REGION` | AWS region (default: `auto`) |
| `S3_ACCESS_KEY_ID` | Access key ID |
| `S3_SECRET_ACCESS_KEY` | Secret access key |
| `S3_BUCKET_NAME` | Bucket name (default: `cloak-renders`) |
| `S3_FORCE_PATH_STYLE` | Set to `true` for MinIO |

### Video Support

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_VIDEO` | `false` | Set to `true` to enable video transcoding |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | Path to FFmpeg binary |
| `FFPROBE_PATH` | `/usr/bin/ffprobe` | Path to FFprobe binary |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Docker Compose

### Minimal (SQLite + Local Storage)

```yaml
services:
  cloakshare:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - CLOAK_SIGNING_SECRET=${CLOAK_SIGNING_SECRET}
      - API_URL=https://api.yourdomain.com
      - VIEWER_URL=https://view.yourdomain.com
    volumes:
      - cloakshare_data:/data

volumes:
  cloakshare_data:
```

### With MinIO (S3 Storage)

```yaml
services:
  cloakshare:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - CLOAK_SIGNING_SECRET=${CLOAK_SIGNING_SECRET}
      - STORAGE_PROVIDER=s3
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY_ID=minioadmin
      - S3_SECRET_ACCESS_KEY=minioadmin
      - S3_BUCKET_NAME=cloakshare
      - S3_FORCE_PATH_STYLE=true
      - ENABLE_VIDEO=true
    depends_on:
      - minio
    volumes:
      - cloakshare_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data

volumes:
  cloakshare_data:
  minio_data:
```

## Reverse Proxy

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (notifications stream)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # Increase body size for file uploads
    client_max_body_size 500M;
}
```

### Caddy

```
api.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Upgrading

```bash
git pull
docker compose build
docker compose up -d
```

Database migrations are applied automatically on startup via `drizzle-kit push`.

## Backup

### SQLite Database

```bash
# Stop the container
docker compose stop cloakshare

# Copy the database
cp ./data/cloak.db ./backups/cloak-$(date +%Y%m%d).db

# Restart
docker compose start cloakshare
```

### S3 Storage

If using MinIO or S3, back up the bucket separately using `mc mirror` or AWS CLI.

## Supported File Types

| Category | Formats | Requirements |
|----------|---------|-------------|
| PDF | PDF | Poppler (`pdftoppm`) |
| Images | PNG, JPG, WebP | Sharp (included) |
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | LibreOffice |
| Video | MP4, MOV, WebM, MKV, AVI | FFmpeg (`ENABLE_VIDEO=true`) |

## Troubleshooting

### File uploads fail with 413

Increase your reverse proxy's body size limit. For Nginx: `client_max_body_size 500M;`

### Video transcoding hangs

Check FFmpeg is installed: `docker exec cloakshare ffmpeg -version`. Video transcoding has a 10-minute timeout per file.

### SSE notifications don't connect

Ensure your reverse proxy has buffering disabled for the `/v1/notifications/stream` endpoint.

### Office document conversion fails

Verify LibreOffice is available: `docker exec cloakshare libreoffice --version`. The Docker image includes LibreOffice by default.
