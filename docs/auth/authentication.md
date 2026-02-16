# Authentication

[Back to root README](../../README.md)


## Overview

This project uses JWT access and refresh tokens.

- access token: short-lived (default `15m`)
- refresh token: long-lived (default `180d`)

Refresh tokens are currently stored in-memory via adapter.

Default user (current simple setup):

- username: `admin`
- password: `password`

## Current Simplification vs Proper Production

Current project simplification:

- Authentication is JWT-based.
- Admin credentials are validated from a bcrypt hash that can be read from a file path:
  - container path: `/run/secrets/admin_password_hash`
  - compose source file: `secrets/admin_password_hash`
- This keeps setup simple for self-hosted local/LAN deployments.

Proper production scenario:

- Terminate TLS and serve API/SPA over HTTPS.
- Use secure cookies (`COOKIE_SECURE=true`) in HTTPS.
- Store JWT secrets and admin credential hash in a managed secret system (not git-tracked files).
- Enforce least-privilege access to secrets and rotate them regularly.

## JWT Environment Variables

```env
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="180d"
```

## Cookie-Based Auth (Recommended)

The API supports HttpOnly cookies for `access_token` and `refresh_token` with CSRF protection.

Behavior:

- `access_token` and `refresh_token` set as HttpOnly cookies
- `csrf_token` cookie is readable by JS
- `/auth/refresh` and `/auth/logout` require `x-csrf-token` header matching cookie value

Frontend requirements:

- send cookies on requests (`credentials: "include"` or `withCredentials: true`)
- send `x-csrf-token` for refresh/logout

Cookie config env:

- `COOKIE_SECURE` (true in HTTPS prod; false for local HTTP)
- `COOKIE_SAMESITE` (`Lax` by default)
- `COOKIE_DOMAIN` (optional)
- `IMAGE_FALLBACK_BASE_URL` (optional)

Notes:

- local HTTP usually needs `COOKIE_SECURE=false`, `COOKIE_SAMESITE=Lax`
- cross-site cookies need `COOKIE_SAMESITE=None` and `COOKIE_SECURE=true` (HTTPS)

## Endpoints

Public:

- `GET /health`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Protected:

- video/series endpoints require `Authorization: Bearer <accessToken>`
- progress endpoints:
  - `GET /progress/:videoId`
  - `POST /progress`

## Auth Flow (curl)

Login:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Use protected endpoint:

```bash
curl http://localhost:8080/videos \
  -H "Authorization: Bearer <accessToken>"
```

Refresh:

```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

Logout:

```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

## Video Progress Integration

Progress is stored in API local file: `data/progress.json`.

`POST /progress` body example:

```json
{
  "videoId": "movie-1",
  "positionSeconds": 12,
  "durationSeconds": 100
}
```

Rules:

- `positionSeconds` must be non-negative
- `durationSeconds` is optional; if provided it must be positive

Suggested frontend behavior:

- on player load: `GET /progress/:videoId`
- during playback: periodic `POST /progress` (for example every 5-10s)
- on end: optionally persist final position
