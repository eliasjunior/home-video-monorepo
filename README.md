# Home Video (Monorepo)

[Documentation](https://github.com/eliasjunior/home-video-docs)

## Project Structure

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

## Environment Files

Which env file is used depends on how you run the FE:
- **Non‑Docker dev** (CRA): `apps/web/.env.development`
- **Docker dev** (compose): `.env.docker.dev`

If the FE is still calling `localhost`, update the **correct** env file and restart the dev server.

## Service URLs

Frontend dev server:
- Default: `http://localhost:3000`

API:
- Default: `http://localhost:8080`

## Docker

### Local Dev

Restart Docker dev stack:
```bash
docker compose --profile dev down
docker compose --profile dev up --build
```

Build API image:
```bash
cd apps/api
npm run docker:build
```

Run API image:
```bash
cd apps/api
npm run docker:run
```

Run API image with env + videos mounted:
```bash
cd apps/api
docker run --rm -p 8080:8080 \
  --env-file .env.docker \
  -v <your-path>:/videos \
  home-video-api:dev
```

### Raspberry Pi (Prod)

See Troubleshooting for Raspberry Pi issue patterns and fixes.

### Google Drive (Raspberry Pi + Docker)

This project can read videos from Google Drive by mounting Drive with `rclone` and exposing the mount to the API container.

#### 1) Configure `rclone` remote

Run on Pi:
```bash
rclone config
```

Notes:
- Use remote type `drive` (Google Drive), not `onedrive`.
- If running via SSH/headless, choose `Use auto config?` = `n` and complete auth using:
  - `rclone authorize "drive" "TOKEN_HERE"` on a machine with browser.

#### 2) Mount Drive read-only

One-time (allow cross-user access for Docker):
```bash
sudo sh -c 'grep -q "^user_allow_other" /etc/fuse.conf || echo user_allow_other >> /etc/fuse.conf'
```

Mount:
```bash
sudo mkdir -p /mnt/gdrive-videos
sudo chown home-user:home-user /mnt/gdrive-videos
rclone mount gdrive: /mnt/gdrive-videos \
  --daemon \
  --read-only \
  --allow-other \
  --vfs-cache-mode full \
  --poll-interval 5m \
  --dir-cache-time 30m
```

Verify on host:
```bash
mount | grep gdrive-videos
ls -la /mnt/gdrive-videos
```

#### 3) Docker + env wiring

In `docker-compose.yml` (`api` service), bind host mount into container:
```yaml
volumes:
  - /mnt:/mnt-host:ro
```

In `.env.docker.api.prod`:
```env
VIDEO_SOURCE_PROFILE=gdrive
VIDEO_PATH=/mnt-host/gdrive-videos
VIDEO_PATH_GDRIVE=/mnt-host/gdrive-videos
MOVIES_DIR=Movies
SERIES_DIR=Series
```

Recreate:
```bash
docker compose --profile prod down
docker compose --profile prod up -d --build api web
```

Verify inside API container:
```bash
docker compose --profile prod exec api sh -lc 'ls -la /mnt-host/gdrive-videos && ls -la /mnt-host/gdrive-videos/Movies'
```

#### 4) Required media layout

Current backend movie scanner expects:
```text
<VIDEO_PATH>/Movies/<MovieFolder>/<videoFile>
```

If files are directly under `Movies` (flat layout), API returns:
- `No videos were found. Expected movies under .../Movies/<MovieFolder>/<videoFile>.`

## Troubleshooting

1. FE calls `localhost` instead of IP
   - Fix: set `REACT_APP_SERVER_HOST=<your-ip>` in the right env file (see Environment Files).
   - Restart FE (CRA or Docker).

2. Cookies not set in dev
   - Ensure `COOKIE_SECURE=false` and `COOKIE_SAMESITE=Lax` for local HTTP.
   - Make sure FE and API are accessed with the **same host** (IP vs localhost).

3. 401 after login in HTTP production
   - Cause: `NODE_ENV=production` defaults secure cookies to `true`.
   - Fix: Set `COOKIE_SECURE=false` when running HTTP (no HTTPS), or move to HTTPS and set it to `true`.

### Docker (Local Dev)

Issue: Docker Compose bcrypt hash truncated  
Cause: `$` in hash is treated as env interpolation.  
Fix: escape `$` as `$$` in `.env.docker`, or move the hash into a Docker secret.

### Raspberry Pi (Prod)

#### Symptoms we hit
- FE loads, but API errors like `GET https://localhost:8080/health net::ERR_SSL_PROTOCOL_ERROR`
- API logs show `/videos/Movies does not exist or cannot access it`
- `curl -I http://localhost:3000` fails even though containers are up

#### Fixes applied

1. Fix API volume mount to the Pi path
   - In `docker-compose.yml` (prod `api`), change:
     - `- <your-path>:/videos`
     - to `- /home/home-user/Videos:/videos`

2. Fix web container port mapping
   - The web container uses nginx (listens on `80` internally).
   - In `docker-compose.yml` (prod `web`), change:
     - `"3000:3000"`
     - to `"3000:80"`

3. Ensure video folder structure exists on the Pi
   ```bash
   mkdir -p /home/home-user/Videos/Movies/TestMovie
   mkdir -p /home/home-user/Videos/Series
   ```

4. Recreate containers to apply changes
   ```bash
   cd /home/home-user/Projects/home-video-monorepo
   docker compose --profile prod up --build -d --force-recreate
   ```

#### Quick verification

- FE should respond:
  ```bash
  curl -I http://localhost:3000
  ```
- API container should see the videos:
  ```bash
  docker exec -it home-video-monorepo-api-1 sh -c "ls -la /videos && ls -la /videos/Movies"
  ```

#### Expected browser access
- Open from another device:
  ```
  http://<PI-IP>:3000
  ```

#### Automation (TODO)
- Use the Pi script below to run all checks and fixes above (paths, ports, folders, rebuild, verify):
  ```bash
  /home/home-user/Projects/home-video-monorepo/scripts/pi-troubleshoot.sh
  ```

### Google Drive + rclone Troubleshooting

1. `didn't find section in config file`
   - Cause: using wrong remote name.
   - Fix: check with `rclone listremotes`, then use the correct one (for example `gdrive:`).

2. `unauthorized_client` / `couldn't fetch token`
   - Cause: OAuth client/token mismatch or invalid OAuth setup.
   - Fix:
     - `rclone config reconnect gdrive:`
     - Ensure type is `drive`
     - If needed, recreate remote with `rclone config`.

3. `Daemon timed out` on `rclone mount --daemon`
   - Cause: hidden mount error in background mode.
   - Fix: run foreground first:
     ```bash
     rclone mount gdrive: /mnt/gdrive-videos --read-only --vfs-cache-mode full -vv
     ```

4. `Permission denied` from container on mounted folder
   - Cause: FUSE mount not accessible to container context.
   - Fix:
     - enable `user_allow_other` in `/etc/fuse.conf`
     - mount with `--allow-other`
     - prefer `/mnt/...` over `/home/...` for Docker bind.

5. API says `.../Movies does not exist or cannot access it`
   - Cause: wrong container path or volume mapping.
   - Fix:
     - container should read `/mnt-host/gdrive-videos`
     - compose should mount `/mnt:/mnt-host:ro`.

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

## Frontend (apps/web)

Run in isolation:
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

Run in isolation:
```bash
cd apps/api
npm install
npm test
npm run dev
```
