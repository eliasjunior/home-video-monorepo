# Home video API

[Documentation](https://github.com/eliasjunior/home-video-docs)

## Setup

```bash
npm install
npm test
npm run dev
```

## Docker (Local Dev)

Build:
```bash
npm run docker:build
```

Run:
```bash
npm run docker:run
```

Run with env + videos mounted:
```bash
docker run --rm -p 8080:8080 \
  --env-file .env.docker \
  -v /Users/eliasjunior/Downloads/Videos:/videos \
  home-video-api:dev
```

## Environment Variables

JWT settings (required for auth):

```env
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="180d"
```

## Authentication Overview

This project uses **JWT access + refresh tokens**:
- Access token: short‑lived (default `15m`) and sent on every protected request.
- Refresh token: long‑lived (default `180d`) and used to get a new access token.

Refresh tokens are stored **in memory** via an adapter. This is intentional for now and will be replaced later with a persistent store.

Default user (hard‑coded):
- `username`: `admin`
- `password`: `password`

## Cookie-Based Auth (Recommended)

The API also supports **HttpOnly cookies** for access/refresh tokens with SameSite + CSRF protection.

How it works:
- `access_token` and `refresh_token` are set as **HttpOnly** cookies.
- A `csrf_token` cookie is set (readable by JS).
- For `/auth/refresh` and `/auth/logout`, the client must send the header:
  - `x-csrf-token: <csrf_token cookie value>`

Frontend requirements:
- Always send cookies: `credentials: "include"` (fetch) or `withCredentials: true` (axios).
- For refresh/logout, read `csrf_token` from `document.cookie` and send it in `x-csrf-token`.

Example (fetch):
```js
function getCookie(name) {
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function refresh() {
  const csrf = getCookie("csrf_token");
  const res = await fetch("http://localhost:8080/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf || "",
    },
    credentials: "include",
  });
  return res.json();
}
```

Config (env):
- `COOKIE_SECURE` (true in prod; false for local HTTP)
- `COOKIE_SAMESITE` (`Lax` by default)
- `COOKIE_DOMAIN` (optional)
- `IMAGE_FALLBACK_BASE_URL` (optional; default is API `/public`)

Cookie notes:
- Local dev over HTTP should use `COOKIE_SECURE=false` and `COOKIE_SAMESITE=Lax`.
- Cross-site cookies require `COOKIE_SAMESITE=None` **and** `COOKIE_SECURE=true` (HTTPS).

## Admin Credentials (Simple, Secure)

Use a bcrypt hash in env (preferred):
```env
ADMIN_USERNAME="admin"
ADMIN_PASSWORD_HASH="<bcrypt hash>"
```

Generate a hash:
```bash
npm run hash:password -- "your-strong-password"
```

Dev/test can use plaintext for convenience (avoid in prod):
```env
ADMIN_PASSWORD="password"
```

## Endpoints

Public:
- `GET /health`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Protected:
- All existing video/series endpoints require `Authorization: Bearer <accessToken>`.
- Progress endpoints (require auth):
  - `GET /progress/:videoId`
  - `POST /progress`

## Auth Flow (Example)

### SPA Redirect Behavior
The API returns `401` JSON for missing/invalid access tokens.  
The **React SPA** should catch `401` and redirect the user to `/login`.

### 1) Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Response includes:
```json
{ "accessToken": "..." }
```

### 2) Call Protected Endpoint
```bash
curl http://localhost:8080/videos \
  -H "Authorization: Bearer <accessToken>"
```

### 3) Refresh Tokens
```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

### 4) Logout (revoke refresh token)
```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

## Notes
- Refresh tokens are rotated on each refresh call.
- Tokens are in memory; restarting the server clears refresh tokens.

## Video Progress (FE Integration)

The API stores per-user video progress in a local JSON file at `data/progress.json`.
Each user is keyed by `req.user.id`, so authentication must run before these routes.

### Store/Update Progress

Endpoint:
- `POST /progress`

Body:
```json
{
  "videoId": "movie-1",
  "positionSeconds": 12,
  "durationSeconds": 100
}
```

Rules:
- `positionSeconds` must be a non-negative number.
- `durationSeconds` is optional; if provided, it must be a positive number.

Example:
```bash
curl -X POST http://localhost:8080/progress \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"videoId":"movie-1","positionSeconds":12,"durationSeconds":100}'
```

### Fetch Progress

Endpoint:
- `GET /progress/:videoId`

Example:
```bash
curl http://localhost:8080/progress/movie-1 \
  -H "Authorization: Bearer <accessToken>"
```

Responses:
- `200` with the progress record.
- `404` if no progress exists for the video.
- `400` if user/videoId is missing.

### Frontend Flow (Suggested)

1. On video load:
   - Call `GET /progress/:videoId` and resume playback if a record exists.
2. During playback:
   - Periodically (e.g., every 5–10 seconds) call `POST /progress` with the current
     `positionSeconds` and `durationSeconds`.
3. On video end:
   - Optionally call `POST /progress` with `positionSeconds` = `durationSeconds`.

Notes:
- Progress is stored locally on the API in `data/progress.json`. Restarting the server
  does not clear progress, but deleting the file will.
