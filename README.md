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
FILE_WATCHER_ENABLED=true      # Enable file system monitoring and WebSocket updates
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

# OAuth2 Integration
OAUTH2_GOOGLE_URL=http://auth-service:8080/oauth2/authorization/google

# Nextcloud Sync (Optional)
NEXTCLOUD_SYNC_ENABLED=false
NEXTCLOUD_DATA_PATH=/var/snap/nextcloud/common/nextcloud/data
NEXTCLOUD_SYNC_EXISTING=false

# Nextcloud Authentication (Optional)
NEXTCLOUD_AUTH_ENABLED=false
NEXTCLOUD_URL=https://nextcloud.example.com
OAUTH2_NEXTCLOUD_SSO_URL=https://nextcloud.example.com/apps/oauth2/authorize
# Nextcloud session prefix (nc_session: for native, spring:session:sessions: for Spring)
NEXTCLOUD_SESSION_PREFIX=nc_session:
```

See `.env.docker.api.prod` for all available options.

## Features

### Authentication Methods

The application supports multiple authentication methods:

1. **JWT Authentication** - Default method using access and refresh tokens
2. **JWKS Validation** - Validates tokens from external auth services (supports both symmetric and asymmetric keys)
3. **Spring Session SSO** - Integrates with Spring Boot applications via Redis-backed sessions
4. **Login Second Retry** - Falls back to external authentication service if local validation fails
   - Two-step authentication flow: fetches CSRF token, then authenticates with CSRF header
   - Supports dynamic CSRF header names (e.g., `X-XSRF-TOKEN`, `X-CSRF-TOKEN`)
   - Configurable via `LOGIN_SECOND_RETRY` and `LOGIN_SECOND_RETRY_URL` environment variables
   - Useful for hybrid authentication scenarios
5. **Google OAuth2** - Optional "Sign in with Google" button
   - Configurable via `OAUTH2_GOOGLE_URL` environment variable
   - Redirects to external OAuth2 authorization endpoint
6. **Nextcloud Authentication** - Three authentication methods for Nextcloud integration:
   - **App Password**: WebDAV authentication using Nextcloud app passwords
   - **SSO**: OAuth2 single sign-on integration with Nextcloud
   - **Redis Session**: Automatic authentication by checking Nextcloud sessions in Redis
   - Configurable via `NEXTCLOUD_AUTH_ENABLED`, `NEXTCLOUD_URL`, and related environment variables
   - Seamlessly integrates with Nextcloud user accounts

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

### Real-Time Updates

The application features **automatic page updates** when video files are added or removed:

- **WebSocket Integration**: Real-time communication between server and clients
- **File System Monitoring**: Automatically detects changes in video directories using Node.js `fs.watch`
- **User-Specific Notifications**: In multi-user mode, each user only receives updates for their own videos
- **Auto-Reconnection**: Client automatically reconnects if connection is lost
- **Configurable**: Enable/disable via `FILE_WATCHER_ENABLED=true` (enabled by default)
- **PUBLIC_URL Support**: WebSocket endpoint respects PUBLIC_URL configuration

**How it works**: When you add or remove video files in your Movies or Series directories, the page automatically refreshes the video list without requiring a manual page reload.

**Technical Details**:
- WebSocket endpoint: `ws://your-server:port/your-public-url/ws`
- File watcher monitors: `/mnt-host/<username>/Movies/` and `/mnt-host/<username>/Series/`
- Events filtered by username in multi-user mode
- Reconnection: Max 5 attempts with 3-second delay

### Nextcloud Sync (Optional)

The application supports **automatic synchronization** with Nextcloud for seamless video management:

- **Bidirectional Sync**: Automatically copies videos from Nextcloud to home-video and removes them when deleted
- **User-Scoped Sync**: Each Nextcloud user's files sync to their corresponding home-video directory
- **Real-Time Monitoring**: Detects file changes immediately using file system watching
- **Supported Formats**: Only syncs video files (mp4, mkv, avi, mov, m4v)
- **Safe Operation**: Skips broken symlinks and handles permission errors gracefully
- **Configurable**: Enable/disable via `NEXTCLOUD_SYNC_ENABLED` environment variable

**How it works**:
1. Users upload videos via Nextcloud (web/mobile app)
2. Videos are automatically copied to home-video's user directory
3. Videos appear immediately in home-video web interface (via WebSocket updates)
4. When videos are deleted from Nextcloud, they're removed from home-video too

**Use Case**: Use Nextcloud as the upload interface and home-video as the streaming/viewing interface.

**Configuration**:
```bash
NEXTCLOUD_SYNC_ENABLED=true
NEXTCLOUD_DATA_PATH=/var/snap/nextcloud/common/nextcloud/data
NEXTCLOUD_SYNC_EXISTING=false  # Set to true to sync existing files on startup
```

See [`docs/features/nextcloud-sync.md`](docs/features/nextcloud-sync.md) for detailed setup instructions.

## Documentation

- Monorepo docs index: [`docs/README.md`](docs/README.md)
- Local dev: [`docs/setup/local-dev.md`](docs/setup/local-dev.md)
- Raspberry Pi basic startup (manual): [`docs/deploy/pi-basic-startup.md`](docs/deploy/pi-basic-startup.md)
- Raspberry Pi deploy: [`docs/deploy/raspberry-pi.md`](docs/deploy/raspberry-pi.md)
- Google Drive + `rclone`: [`docs/storage/google-drive-rclone.md`](docs/storage/google-drive-rclone.md)
- Backend media scanning: [`docs/backend/media-scanning.md`](docs/backend/media-scanning.md)
- Authentication: [`docs/auth/authentication.md`](docs/auth/authentication.md)
- Nextcloud sync: [`docs/features/nextcloud-sync.md`](docs/features/nextcloud-sync.md)
- Multi-user security: [`docs/security/multi-user-isolation.md`](docs/security/multi-user-isolation.md)
- Troubleshooting: [`docs/troubleshooting/common-issues.md`](docs/troubleshooting/common-issues.md)

## Legacy Docs

The previous polyrepo docs are kept for historical context:

- [home-video-docs](https://github.com/eliasjunior/home-video-docs)

Monorepo docs should be preferred when instructions conflict.
