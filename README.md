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

# Nextcloud Integration (Optional)
# File Synchronization
NEXTCLOUD_SYNC_ENABLED=false
NEXTCLOUD_DATA_PATH=/var/snap/nextcloud/common/nextcloud/data
NEXTCLOUD_SYNC_EXISTING=false

# Direct Streaming & Authentication
NEXTCLOUD_AUTH_ENABLED=false
NEXTCLOUD_URL=https://nextcloud.example.com
NEXTCLOUD_SESSION_PREFIX=PHPREDIS_SESSION:
```

See `.env.docker.api.prod` for all available options.

## Features

### Authentication Methods

The application supports multiple authentication methods:

1. **JWT Authentication** - Default method using access and refresh tokens
   - Token validation decodes JWT without enforcing expiration
   - Sessions persist based on cookie presence and user validity (not JWT expiration time)
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
6. **Nextcloud Authentication** - Multiple authentication methods for Nextcloud integration:
   - **App Password Login**: Users explicitly login with Nextcloud app password (72+ character secure token)
   - **Automatic Detection**: Regular login automatically checks Nextcloud access with same credentials
   - **Redis Session SSO**: Automatic authentication by checking Nextcloud PHP sessions in Redis
   - Configurable via `NEXTCLOUD_AUTH_ENABLED`, `NEXTCLOUD_URL`, and `NEXTCLOUD_SESSION_PREFIX`
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

### Nextcloud Integration (Optional)

The application supports **two modes of Nextcloud integration**:

#### Mode 1: File Synchronization

**Automatic synchronization** with Nextcloud for seamless video management:

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

#### Mode 2: Direct Streaming & Authentication

**Stream videos directly from Nextcloud** without local file copying:

- **OCS Share API Integration**: Fetches videos shared with authenticated user via Nextcloud Shares API
- **Direct WebDAV Streaming**: Videos stream from Nextcloud in real-time (no local storage needed)
- **Backend Proxy**: Server-side proxy handles WebDAV authentication and streaming to avoid CORS
- **Merged Display**: Nextcloud shared videos appear alongside local videos in the same dashboard
- **Three Authentication Methods**:
  1. **App Password Login**: Users explicitly choose "Use Nextcloud App Password" during login
  2. **Automatic Detection**: Regular login auto-checks if user has Nextcloud access with same credentials
  3. **Redis Session SSO**: Automatic authentication via existing Nextcloud PHP sessions in Redis

**How it works**:
1. User logs in (with app password or regular credentials)
2. System checks Nextcloud access and fetches shared videos from OCS Share API
3. Videos displayed with "Shared by {owner}" folder name
4. When clicked, backend proxies WebDAV streaming from Nextcloud
5. Video plays directly without downloading

**Use Case**: Stream videos shared with you in Nextcloud without duplicating files locally.

**Configuration**:
```bash
NEXTCLOUD_AUTH_ENABLED=true
NEXTCLOUD_URL=https://cloud.example.com/nextcloud
NEXTCLOUD_SESSION_PREFIX=PHPREDIS_SESSION:  # For Redis session SSO
REDIS_PASSWORD=your-redis-password          # If using Redis session SSO
```

**User Experience**:
- Login page shows "Use Nextcloud App Password" checkbox with help dialog
- Help dialog explains how to generate Nextcloud app passwords
- After login, Nextcloud videos automatically appear alongside local videos
- Click any Nextcloud video to stream directly from Nextcloud

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
