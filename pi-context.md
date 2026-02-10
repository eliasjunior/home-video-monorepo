# Agents Guide (Raspberry Pi Deployment)

This document defines how AI agents should deploy the Home Video app to a
Raspberry Pi. Agents must rely strictly on the provided context and tasks
and must not assume capabilities beyond what is explicitly stated.

---

## Base Context (Monorepo)

- Repo path on Pi: `/home/gandalf/Projects/home-video-monorepo`
- This is a monorepo with:
  - `apps/api` (Node.js backend)
  - `apps/web` (React frontend)
- Deployment target: Raspberry Pi on the local network
- Transport: HTTP only (no HTTPS yet)
- Access pattern: always use the Pi IP in the browser (no `localhost`)

---

# Pi Setup + Verification Checklist

Project path on Pi:
`/home/gandalf/Projects/home-video-monorepo`

Pi IP for browser access:
`192.168.68.120`

Video folder:
`/home/gandalf/Videos`

Protocol:
`http` (no HTTPS for now)

---

## 1. Repo Update

Commands:
```bash
cd /home/gandalf/Projects/home-video-monorepo
git pull
```

## 2. Env Files (Prod, Per App)

Ensure these exist and are populated:
- `.env.docker.api.prod`
- `.env.docker.web.prod`

Commands to check:
```bash
ls -la /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod
ls -la /home/gandalf/Projects/home-video-monorepo/.env.docker.web.prod
```

Optional: create from dev if missing:
```bash
cp -n /home/gandalf/Projects/home-video-monorepo/.env.docker.api.dev /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod
cp -n /home/gandalf/Projects/home-video-monorepo/.env.docker.web.dev /home/gandalf/Projects/home-video-monorepo/.env.docker.web.prod
```

Set FE host and protocol for prod:
```bash
sed -i.bak 's/^REACT_APP_SERVER_HOST=.*/REACT_APP_SERVER_HOST=192.168.68.120/' /home/gandalf/Projects/home-video-monorepo/.env.docker.web.prod
sed -i.bak 's/^REACT_APP_SERVER_PROTOCOL=.*/REACT_APP_SERVER_PROTOCOL=http/' /home/gandalf/Projects/home-video-monorepo/.env.docker.web.prod
```

### Admin Password Hash (Docker Secret)

Store the bcrypt hash in a Docker secret file instead of `.env`:

```bash
mkdir -p /home/gandalf/Projects/home-video-monorepo/secrets
printf '%s' '<bcrypt-hash>' > /home/gandalf/Projects/home-video-monorepo/secrets/admin_password_hash
```

The `docker-compose.yml` mounts this secret at `/run/secrets/admin_password_hash`,
and the API reads it via `ADMIN_PASSWORD_HASH_FILE`.

## 3. Video Path + Volume Mount

Ensure the folder exists:
```bash
ls -la /home/gandalf/Videos
```

Check the volume mount in `docker-compose.yml`:
```bash
rg --fixed-strings "/home/gandalf/Videos:/videos" /home/gandalf/Projects/home-video-monorepo/docker-compose.yml
```

If missing, update `docker-compose.yml`:
```bash
sed -i.bak 's|/.*Videos:/videos|/home/gandalf/Videos:/videos|' /home/gandalf/Projects/home-video-monorepo/docker-compose.yml
```

## 4. Port Checks (No Firewall)

Check if ports are already in use:
```bash
sudo lsof -i :3000
sudo lsof -i :8080
```

## 5. Build & Run (Prod Profile)

Commands:
```bash
cd /home/gandalf/Projects/home-video-monorepo
docker compose --profile prod up --build
```

## 6. Access From Another Device

Open in browser:
```
http://192.168.68.120:3000
```

Expected behavior:
- FE will call API at `http://192.168.68.120:8080` automatically in development mode.
- For production, ensure `REACT_APP_SERVER_HOST` in `.env.docker.web.prod` matches the same IP.

## Common Issue: Images Missing on Phone (but OK on PC)

Symptom:
- Phone shows broken images, while the PC browser works.
- Broken image URL looks like `http://localhost:8080/public/...`

Cause:
- API image URLs are built using `localhost`. On a phone, `localhost` refers to the phone, not the Pi.

Fix (on Pi):
```bash
sed -i.bak 's/^IMAGES_HOST_SERVER=.*/IMAGES_HOST_SERVER=192.168.68.120/' /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod
sed -i.bak 's/^IMAGES_PORT_SERVER=.*/IMAGES_PORT_SERVER=8080/' /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod
sed -i.bak 's|^IMAGE_FALLBACK_BASE_URL=.*|IMAGE_FALLBACK_BASE_URL=http://192.168.68.120:8080/public|' /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod

cd /home/gandalf/Projects/home-video-monorepo
docker compose --profile prod up --build -d --force-recreate
```

## Common Issue: 401 Unauthorized After Login (HTTP + Production)

Symptoms:
- Login succeeds, but protected endpoints (e.g. `/videos`) return `401`.
- Works in dev, breaks in production over HTTP.

Cause:
- In production, cookies default to `Secure=true`.
- Secure cookies are not sent over plain HTTP, so the browser never includes the
  `access_token` cookie on subsequent requests.

Fix (HTTP + production):
1) Ensure `COOKIE_SECURE=false` in `.env.docker.api.prod`:
```bash
sed -i.bak 's/^COOKIE_SECURE=.*/COOKIE_SECURE=false/' /home/gandalf/Projects/home-video-monorepo/.env.docker.api.prod
```

2) Pull the latest code change that respects `COOKIE_SECURE=false` in production:
```bash
cd /home/gandalf/Projects/home-video-monorepo
git pull
```

3) Rebuild/recreate containers:
```bash
docker compose --profile prod up --build -d --force-recreate
```

Verification:
- Login in the browser and open DevTools → Network → request headers.
- Confirm the cookie `access_token` is being sent on `/videos` calls.

Notes:
- If/when you enable HTTPS, switch `COOKIE_SECURE=true`.
