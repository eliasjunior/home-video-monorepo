# Home Video (Monorepo)

[Documentation](https://github.com/eliasjunior/home-video-docs)

This repo contains:
- `apps/web`: React frontend
- `apps/api`: Node.js backend

## High-Level Overview

Home Video is a small self-hosted web app for streaming personal videos over your local network, built as a learning project rather than a full media server. The Node.js backend discovers and streams files from a simple folder structure (movies/series/images/subtitles), while the React frontend provides a responsive UI for browsing, searching, and playback. It’s intended to run on a local machine (e.g., a spare PC or Raspberry Pi) with explicit env-based configuration for IP and media paths.

## Quick Start (Local Dev)

Install dependencies:
```bash
npm install
```

Run both apps:
```bash
npm run dev
```

Restart Docker dev stack:
```bash
docker compose --profile dev down
docker compose --profile dev up --build
```

## Dev Env Files (Important)

Which env file is used depends on how you run the FE:
- **Non‑Docker dev** (CRA): `apps/web/.env.development`
- **Docker dev** (compose): `.env.docker.dev`

If the FE is still calling `localhost`, update the **correct** env file and restart the dev server.

## Common Issues (Recent)

1. FE calls `localhost` instead of IP
   - Fix: set `REACT_APP_SERVER_HOST=<your-ip>` in the right env file.
   - Restart FE (CRA or Docker).

2. Docker Compose bcrypt hash truncated
   - Cause: `$` in hash is treated as env interpolation.
   - Fix: escape `$` as `$$` in `.env.docker`.

3. Cookies not set in dev
   - Ensure `COOKIE_SECURE=false` and `COOKIE_SAMESITE=Lax` for local HTTP.
   - Make sure FE and API are accessed with the **same host** (IP vs localhost).

Frontend dev server:
- Default: `http://localhost:3000`

API:
- Default: `http://localhost:8080`

## Frontend (apps/web)

Install and run:
```bash
cd apps/web
npm install
npm run dev
```

Notes:
- The app uses a proxy in `apps/web/package.json` for API requests.
- If you access the FE from another device, use your machine IP for the API
  (e.g., `http://192.168.x.x:8080`) and load the FE from the same host.

## Backend (apps/api)

Install and run:
```bash
cd apps/api
npm install
npm test
npm run dev
```

### Docker (Local Dev)

Build:
```bash
cd apps/api
npm run docker:build
```

Run:
```bash
cd apps/api
npm run docker:run
```

Run with env + videos mounted:
```bash
cd apps/api
docker run --rm -p 8080:8080 \
  --env-file .env.docker \
  -v /Users/eliasjunior/Downloads/Videos:/videos \
  home-video-api:dev
```

## API Environment Variables (apps/api)

JWT settings (required for auth):
```env
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="180d"
```

Cookie config:
- `COOKIE_SECURE` (true in prod; false for local HTTP)
- `COOKIE_SAMESITE` (`Lax` by default)
- `COOKIE_DOMAIN` (optional)
- `IMAGE_FALLBACK_BASE_URL` (optional; default is API `/public`)

Cookie notes:
- Local dev over HTTP should use `COOKIE_SECURE=false` and `COOKIE_SAMESITE=Lax`.
- Cross-site cookies require `COOKIE_SAMESITE=None` **and** `COOKIE_SECURE=true` (HTTPS).

## Authentication Overview

This project uses **JWT access + refresh tokens**:
- Access token: short‑lived (default `15m`) and sent on every protected request.
- Refresh token: long‑lived (default `180d`) and used to get a new access token.

Refresh tokens are stored **in memory** via an adapter. This is intentional for now and will be replaced later with a persistent store.

Default user (hard‑coded):
- `username`: `admin`
- `password`: `password`

### Cookie-Based Auth (Recommended)

The API supports **HttpOnly cookies** for access/refresh tokens with SameSite + CSRF protection.

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

### 1) Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
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

### Fetch Progress

Endpoint:
- `GET /progress/:videoId`

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
