# Agents Guide

This document defines how AI agents should interact with this project.
Agents must rely strictly on the provided context and tasks and must not
assume capabilities beyond what is explicitly stated.

---

## Base Context (Monorepo)

- This is a **monorepo** with:
  - `apps/api`: Node.js backend
  - `apps/web`: React frontend
- Project purpose:
  - Hobby / learning project
  - Focused on gradual improvement (“baby steps”).
- Stability and clarity are more important than bleeding-edge features.
- Each app is expected to **run locally** after every change.

---

## Environment Constraints

- Agents:
  - ❌ cannot change Node versions
  - ❌ cannot elevate permissions
  - ❌ cannot change anything before asking permission.
- Human (me):
  - ✅ can run shell commands
  - ✅ can upgrade Node manually
  - ✅ can update and should update files withing the project context, ask confirmation
  - ✅ will paste back logs and errors

Agents must:
- Ask me to run commands when needed
- Provide **exact commands** to run
- Clearly explain why a command is required


## Frontend Context (apps/web)

- This is a **React SPA** (client for the API).
- Stability and clarity are more important than bleeding-edge changes.
- The app is expected to **run locally** after every change.
- Backend authentication supports multiple methods:
  - **JWT access + refresh tokens**
  - **Spring Session SSO via Redis** (for multi-app authentication)

---

## Backend Context (apps/api)

### Authentication Architecture

The backend supports **four authentication methods**:

1. **JWT with Local Secret**
   - Tokens issued by the Node.js app using `JWT_ACCESS_SECRET`
   - Default method for standalone deployments
   - Access tokens are short-lived (15m default, but expiration is not enforced)
   - Refresh tokens are long-lived (180d default)
   - **Token validation**: Decodes JWT without verifying expiration; validates by checking user existence in store
   - Sessions persist as long as cookie exists and user is valid (not tied to JWT expiration)

2. **JWKS Validation**
   - Validates JWT tokens from external auth services
   - Supports both **symmetric keys** (HMAC/HS256) and **asymmetric keys** (RSA/EC)
   - Fetches keys from `JWKS_URL` endpoint
   - Falls back from local secret to JWKS if local validation fails
   - Keys are cached for 1 hour to improve performance

3. **Spring Session SSO via Redis**
   - Reads sessions created by Spring Boot authentication services
   - Sessions stored in Redis using Spring Session format
   - Supports cookie names: `SESSION`, `SESSIONID`, `JSESSIONID`
   - Parses Spring Security context (JSON format)
   - Extracts user information and authorities from session data
   - Session-first authentication (checks Redis before JWT)

4. **Login Second Retry**
   - Fallback authentication mechanism when local validation fails
   - Two-step authentication flow:
     1. Fetches CSRF token from external service (`{base_url}/csrf`)
     2. POSTs credentials to external authentication service with CSRF header
   - Supports dynamic CSRF header names (e.g., `X-XSRF-TOKEN`, `X-CSRF-TOKEN`)
   - Uses `application/x-www-form-urlencoded` content type for authentication
   - Client-side implementation in React login component
   - Configurable via `LOGIN_SECOND_RETRY` and `LOGIN_SECOND_RETRY_URL` environment variables
   - External service URL example: `http://auth-service:8080/api/authenticate`

### Merged Application

The API and Web apps are **merged into a single deployable unit**:

- API serves both REST endpoints and React static files
- Single Docker image for production deployment
- Multi-stage build: builds React, then copies to API
- API serves React app and API routes with configurable `PUBLIC_URL` prefix (default: `/home-video`)
- Simplified deployment and session management

### Multi-User Support

The application supports **application-level multi-tenancy** for isolated user video libraries:

- **User Storage**: JSON-based user store at `data/users.json`
- **Directory Structure**: Each user gets isolated directories at `/mnt-host/{username}/Movies` and `/mnt-host/{username}/Series`
- **Automatic Provisioning**: User records and directories created automatically on first login
- **Per-User Content**: All API endpoints (videos, images, captions) automatically filter by authenticated user
- **Configurable**: Enable/disable via `MULTI_USER_ENABLED` environment variable
- **Backward Compatible**: When disabled, all users share the same video directory

**User Directory Layout**:
```
/mnt-host/
  ├── admin/
  │   ├── Movies/
  │   └── Series/
  ├── user1@example.com/
  │   ├── Movies/
  │   └── Series/
  └── user2@example.com/
      ├── Movies/
      └── Series/
```

### Real-Time Updates with WebSocket

The application supports **real-time automatic page updates** when video files are added or removed:

- **File Watching**: Monitors video directories for file system changes using Node.js `fs.watch`
- **WebSocket Broadcasting**: Broadcasts file change events to connected clients
- **User-Specific Events**: In multi-user mode, only notifies users when their own videos change
- **Auto-Reconnection**: Client automatically reconnects if WebSocket connection is lost (max 5 attempts, 3s delay)
- **Configurable**: Enable/disable via `FILE_WATCHER_ENABLED` environment variable (default: true)
- **PUBLIC_URL Support**: WebSocket path respects PUBLIC_URL configuration (e.g., `/home-video/ws`)

**How it works**:
1. File watcher detects changes in user directories (`/mnt-host/<username>/Movies/` or `/mnt-host/<username>/Series/`)
2. WebSocket server broadcasts events with username and category (movies/series)
3. Connected clients filter events by username and refresh their video list automatically
4. No page refresh needed when adding/removing video files

**WebSocket Connection**: `ws://localhost:8081/home-video/ws` (or your configured PUBLIC_URL)

### Nextcloud Integration

The application supports **two modes of Nextcloud integration**:

#### 1. Nextcloud Sync (File Synchronization)

**Automatic synchronization** with Nextcloud for seamless video management:

- **Bidirectional Sync**: Automatically copies new videos from Nextcloud to home-video and deletes them when removed from Nextcloud
- **User-Scoped**: Each Nextcloud user's files sync to their corresponding home-video directory
- **Video Format Detection**: Only syncs supported video formats (mp4, mkv, avi, mov, m4v)
- **Real-Time Monitoring**: Uses file system watching to detect changes immediately
- **Symlink Safe**: Skips broken symlinks and inaccessible directories
- **Configurable**: Enable/disable via `NEXTCLOUD_SYNC_ENABLED` environment variable

**How it works**:
1. Monitors Nextcloud data directory for file changes (add/delete)
2. Extracts username from Nextcloud path structure
3. When video is added → Copies to `/data/home-video/<username>/Movies/`
4. When video is deleted → Removes from `/data/home-video/<username>/Movies/`
5. Integrates with file watcher and WebSocket for real-time UI updates

**Use Case**: Users upload videos via Nextcloud mobile app → Videos automatically appear in home-video web interface

#### 2. Nextcloud Authentication & Streaming (Direct Access)

**Stream videos directly from Nextcloud** without local copying:

- **App Password Authentication**: Users login with Nextcloud app password (72+ character secure token)
- **Automatic Detection**: When logging in with regular credentials, automatically checks if user has Nextcloud access
- **OCS Share API**: Fetches videos shared with the authenticated user via Nextcloud Shares API
- **Direct Streaming**: Videos are streamed from Nextcloud WebDAV in real-time (no local storage needed)
- **Backend Proxy**: Server-side proxy handles WebDAV authentication and streaming to avoid CORS
- **Redis Session Support**: Can authenticate via Nextcloud Redis sessions (PHP serialized format)
- **Merged Display**: Nextcloud videos appear alongside local videos in the same dashboard

**Authentication Methods**:
1. **Nextcloud App Password Login**: Check "Use Nextcloud App Password" and provide app password
2. **Automatic with Regular Login**: System auto-detects Nextcloud access when using same credentials
3. **Redis Session SSO**: Authenticate via existing Nextcloud session stored in Redis

**How it works**:
1. User logs in with Nextcloud credentials (or system detects Nextcloud access)
2. Frontend stores credentials in sessionStorage
3. Dashboard fetches shared videos from Nextcloud OCS API (`/ocs/v2.php/apps/files_sharing/api/v1/shares`)
4. Videos are displayed with "Shared by {owner}" folder name
5. When clicked, backend proxies WebDAV streaming (`/remote.php/dav/files/{username}/{path}`)
6. Video plays directly from Nextcloud without downloading

**Configuration**:
```bash
NEXTCLOUD_AUTH_ENABLED=true
NEXTCLOUD_URL=https://your-nextcloud.com/nextcloud
SSO_REDIS_ENABLED=true                           # Optional: for Redis session support
NEXTCLOUD_SESSION_PREFIX=PHPREDIS_SESSION:       # Redis key prefix for Nextcloud sessions
REDIS_PASSWORD=your-redis-password
```

**Use Case**: Users with existing Nextcloud shared videos can stream them directly without duplicating files locally

### Key Implementation Files

**Authentication:**
1. **`apps/api/src/auth/tokenService.js`** - JWT token issuance/validation, JWKS fetching
2. **`apps/api/src/auth/redisSessionStore.js`** - Session middleware configuration
3. **`apps/api/src/auth/springSessionStore.js`** - Spring Session format support
4. **`apps/api/src/middleware/auth.js`** - Session-first auth flow, user context attachment
5. **`apps/api/src/routers/AuthRouter.js`** - Login/logout, second retry, user registration

**Multi-User:**
6. **`apps/api/src/user/userStore.js`** - JSON-based user storage and management
7. **`apps/api/src/user/userDirectory.js`** - User directory creation and path resolution
8. **`apps/api/src/routers/VideosRouter.js`** - User-specific video path filtering
9. **`apps/api/src/routers/ImagesRouter.js`** - User-specific image serving
10. **`apps/api/src/routers/CaptionsRouter.js`** - User-specific caption serving

**WebSocket & Real-Time:**
11. **`apps/api/src/services/fileWatcherService.js`** - File system monitoring service
12. **`apps/api/src/services/websocketService.js`** - WebSocket server and broadcasting
13. **`apps/api/src/composition/startup.js`** - WebSocket and file watcher initialization
14. **`apps/web/src/hooks/useWebSocket.js`** - React WebSocket hook with auto-reconnect
15. **`apps/web/src/components/video/components/VideoMainList.jsx`** - User-filtered real-time updates

**Nextcloud Integration:**
16. **`apps/api/src/services/nextcloudSyncService.js`** - Nextcloud to home-video synchronization service
17. **`apps/api/src/auth/nextcloudAuthService.js`** - Nextcloud authentication, OCS Share API, Redis session handling
18. **`apps/api/src/routers/VideosRouter.js`** - Nextcloud video streaming proxy endpoint
19. **`apps/web/src/components/video/components/Player.jsx`** - Nextcloud video detection and streaming
20. **`apps/web/src/components/video/components/VideoMainList.jsx`** - Merged local and Nextcloud video display
21. **`apps/web/src/components/auth/Login.jsx`** - Nextcloud app password login with help dialog

**Frontend:**
22. **`apps/web/src/config.js`** - API URL configuration with PUBLIC_URL support
23. **`apps/web/src/main/Routers.js`** - React Router with basename configuration
24. **`apps/web/src/services/Api.js`** - API client with getCurrentUser() for WebSocket filtering

**Security:**
25. **`docs/security/multi-user-isolation.md`** - Multi-user security and isolation documentation

### Environment Configuration

See `.env.docker.api.prod` for all configuration options:

```bash
# JWT Configuration
JWT_ACCESS_SECRET=dev-access-secret
JWT_REFRESH_SECRET=dev-refresh-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=180d

# JWKS Validation
JWKS_VALIDATION=false           # Enable JWKS validation
JWKS_URL=                       # JWKS endpoint URL (e.g., http://auth-service:8080/.well-known/jwks.json)

# Spring Session SSO
SSO_REDIS_ENABLED=false         # Enable Spring Session SSO
USE_SPRING_SESSION=false        # Use Spring Session format (vs express-session)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
SESSION_SECRET=prod-session-secret
SESSION_TTL=86400               # Session TTL in seconds (24 hours)
SESSION_COOKIE_NAME=SESSION     # Cookie name (SESSION or SESSIONID)
SPRING_SESSION_PREFIX=spring:session:sessions:  # Redis key prefix

# Login Second Retry
LOGIN_SECOND_RETRY=false        # Enable second retry authentication
LOGIN_SECOND_RETRY_URL=http://localhost:8080/api/authenticate  # External auth service URL

# OAuth2 Integration
OAUTH2_GOOGLE_URL=              # Google OAuth2 authorization URL (e.g., http://auth-service:8080/oauth2/authorization/google)

# Application Configuration
PUBLIC_URL=/home-video           # URL prefix for app and API endpoints
MULTI_USER_ENABLED=false        # Enable per-user video directories
FILE_WATCHER_ENABLED=true       # Enable file system monitoring and WebSocket updates

# Nextcloud Integration
NEXTCLOUD_SYNC_ENABLED=false    # Enable Nextcloud to home-video file sync
NEXTCLOUD_DATA_PATH=            # Path to Nextcloud data directory (e.g., /var/snap/nextcloud/common/nextcloud/data)
NEXTCLOUD_SYNC_EXISTING=false   # Sync existing files on startup

NEXTCLOUD_AUTH_ENABLED=true     # Enable Nextcloud authentication and streaming
NEXTCLOUD_URL=                  # Nextcloud instance URL (e.g., https://cloud.example.com/nextcloud)
NEXTCLOUD_SESSION_PREFIX=PHPREDIS_SESSION:  # Redis session prefix for Nextcloud
```

---

## Next Steps (Agreed)

1. Add an `rclone` `systemd` service on Raspberry Pi so Google Drive mount starts automatically on reboot.
2. Add a backend guard for flat movie ID collisions (same basename) to avoid ambiguous entries.
3. Open and track a PR including backend changes + documentation updates for reproducibility.

