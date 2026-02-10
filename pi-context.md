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
