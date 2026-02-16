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

The backend supports **three authentication methods**:

1. **JWT with Local Secret**
   - Tokens issued by the Node.js app using `JWT_ACCESS_SECRET`
   - Default method for standalone deployments
   - Access tokens are short-lived (15m default)
   - Refresh tokens are long-lived (180d default)

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

### Login Second Retry

The login endpoint supports a **second retry mechanism** for authentication:

- If local credential validation fails, the system can attempt authentication with an external service
- Configurable via `LOGIN_SECOND_RETRY` environment variable (true/false)
- External service URL configured via `LOGIN_SECOND_RETRY_URL`
- Authentication flow:
  1. **First attempt**: Validates credentials locally
  2. **Second attempt** (if enabled and first fails): POSTs credentials to external service
  3. Extracts token from response headers (`Authorization: Bearer <token>` or `X-Auth-Token`)
  4. Issues local JWT tokens and creates session for the user
  5. Returns success if external authentication succeeds
- Useful for integrating with existing authentication services without full SSO setup

### Merged Application

The API and Web apps are **merged into a single deployable unit**:

- API serves both REST endpoints and React static files
- Single Docker image for production deployment
- Multi-stage build: builds React, then copies to API
- API serves React app from `/` and API routes from specific paths
- Simplified deployment and session management

### Key Implementation Files

1. **`apps/api/src/auth/tokenService.js`**
   - JWT token issuance and validation
   - JWKS fetching and key extraction
   - Symmetric and asymmetric key handling

2. **`apps/api/src/auth/redisSessionStore.js`**
   - Session middleware configuration
   - Spring Session vs express-session toggle
   - Cookie parsing and session loading

3. **`apps/api/src/auth/springSessionStore.js`**
   - Custom session store for Spring Session format
   - Reads Redis Hash structure
   - Parses Spring Security context JSON
   - Validates authentication state

4. **`apps/api/src/middleware/auth.js`**
   - Session-first authentication flow
   - JWT token fallback
   - Request authentication logic

5. **`apps/api/src/routers/AuthRouter.js`**
   - Login/logout endpoints
   - Second retry authentication logic
   - Session storage and cleanup
   - Cookie management

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
```

---

## Next Steps (Agreed)

1. Add an `rclone` `systemd` service on Raspberry Pi so Google Drive mount starts automatically on reboot.
2. Add a backend guard for flat movie ID collisions (same basename) to avoid ambiguous entries.
3. Open and track a PR including backend changes + documentation updates for reproducibility.

