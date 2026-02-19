# Home Video (Monorepo)

Home Video is a small self-hosted app for streaming personal videos over a local network.

This repository is the monorepo version of the project and contains the current source of truth for API, Web, and docs.

## Project Structure

- `apps/web`: React frontend (SPA)
- `apps/api`: Node.js backend (Express)
- `docs`: Monorepo documentation

## Quick Start (Local Dev)

Install dependencies:

```bash
npm install
```

Run both apps in development mode:

```bash
npm run dev
```

## Quick Start (Raspberry Pi)

For Raspberry Pi, start with the manual guide first (recommended):

- [`docs/deploy/pi-basic-startup.md`](docs/deploy/pi-basic-startup.md)

After manual startup is stable, move to one-click/bootstrap + services:

- [`docs/deploy/pi-one-click-bootstrap.md`](docs/deploy/pi-one-click-bootstrap.md)

## Service URLs

- **Development:**
  - Frontend dev server: `http://localhost:3000`
  - API: `http://localhost:8080`

- **Production (merged app):**
  - Single app serving both frontend and API: `http://localhost:8081/home-video` (configurable via `SERVER_PORT` and `PUBLIC_URL`)

## Deployment

### Docker Compose (Production)

The production setup runs both API and Web as a single merged application:

```bash
# Build and start
docker-compose --profile prod up --build -d

# View logs
docker logs home-video-app

# Stop
docker-compose --profile prod down
```

### Configuration

The application uses environment variables for configuration. Key settings in `.env.docker.api.prod`:

**Server:**
```bash
SERVER_PORT=8081                # Server port
PUBLIC_URL=/home-video          # URL prefix for app and API endpoints
VIDEO_PATH=/mnt-host           # Path to video files
MOVIES_DIR=Movies              # Movies subdirectory
SERIES_DIR=Series              # Series subdirectory
MULTI_USER_ENABLED=false       # Enable per-user video directories
```

**Authentication:**
```bash
# JWT (Default)
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=180d

# JWKS Validation (for external auth services)
JWKS_VALIDATION=false
JWKS_URL=http://auth-service:8080/.well-known/jwks.json

# Spring Session SSO (for multi-app authentication)
SSO_REDIS_ENABLED=false
USE_SPRING_SESSION=false
REDIS_HOST=localhost
REDIS_PORT=6379
SESSION_COOKIE_NAME=SESSION

# Login Second Retry (fallback to external auth service)
LOGIN_SECOND_RETRY=false
LOGIN_SECOND_RETRY_URL=http://auth-service:8080/api/authenticate
```

See `.env.docker.api.prod` for all available options.

## Features

### Authentication Methods

The application supports multiple authentication methods:

1. **JWT Authentication** - Default method using access and refresh tokens
2. **JWKS Validation** - Validates tokens from external auth services (supports both symmetric and asymmetric keys)
3. **Spring Session SSO** - Integrates with Spring Boot applications via Redis-backed sessions
4. **Login Second Retry** - Falls back to external authentication service if local validation fails
   - Configurable via `LOGIN_SECOND_RETRY` environment variable
   - POSTs credentials to external service and extracts token from response headers
   - Useful for hybrid authentication scenarios

### Merged Application

In production, the API serves both the REST endpoints and the React frontend as a single application:
- Single Docker container
- Configurable URL prefix via `PUBLIC_URL` (default: `/home-video`)
- Simplified deployment
- Shared session management
- Reduced infrastructure complexity

### Multi-User Support

The application supports **per-user video libraries** for multi-tenant deployments:

- **Enable**: Set `MULTI_USER_ENABLED=true` in environment configuration
- **Directory Structure**: Each user gets isolated directories at `/mnt-host/{username}/Movies` and `/mnt-host/{username}/Series`
- **Automatic Provisioning**: User accounts and directories are created automatically on first login
- **User Isolation**: All API endpoints (videos, images, captions) automatically filter content by authenticated user
- **Backward Compatible**: When disabled (default), all users share the same video directory

**Example Directory Layout**:
```
/mnt-host/
  ├── admin/
  │   ├── Movies/
  │   └── Series/
  └── user@example.com/
      ├── Movies/
      └── Series/
```

**User Data Storage**: Application-level users are stored in `data/users.json` (no OS users created)

## Documentation

- Monorepo docs index: [`docs/README.md`](docs/README.md)
- Local dev: [`docs/setup/local-dev.md`](docs/setup/local-dev.md)
- Raspberry Pi basic startup (manual): [`docs/deploy/pi-basic-startup.md`](docs/deploy/pi-basic-startup.md)
- Raspberry Pi deploy: [`docs/deploy/raspberry-pi.md`](docs/deploy/raspberry-pi.md)
- Google Drive + `rclone`: [`docs/storage/google-drive-rclone.md`](docs/storage/google-drive-rclone.md)
- Backend media scanning: [`docs/backend/media-scanning.md`](docs/backend/media-scanning.md)
- Authentication: [`docs/auth/authentication.md`](docs/auth/authentication.md)
- Troubleshooting: [`docs/troubleshooting/common-issues.md`](docs/troubleshooting/common-issues.md)

## Legacy Docs

The previous polyrepo docs are kept for historical context:

- [home-video-docs](https://github.com/eliasjunior/home-video-docs)

Monorepo docs should be preferred when instructions conflict.
