# Raspberry Pi Basic Startup (No Bootstrap, No Services)

[Back to docs index](../README.md)


This guide is the quickest manual path to run Home Video on Raspberry Pi.

Primary startup helper script for this guide:

- `./scripts/pi/preflight-prod.sh`

It intentionally does **not** use:

- `scripts/pi/bootstrap.sh`
- `scripts/pi/install-systemd.sh`
- `scripts/pi/first-run.sh`
- automatic startup on reboot

Use this when you want only the basics to get the app running now.

## Checklist

- [ ] Install required tools on Pi: `docker`, `docker compose`, `rclone`, `git`, `node`, `npm`.
- [ ] Clone repo on Pi and enter it:
  - `git clone <repo-url> /home/<user>/Projects/home-video-monorepo`
  - `cd /home/<user>/Projects/home-video-monorepo`
- [ ] Ensure prod env files exist:
  - `.env.docker.api.prod`
  - `.env.docker.web.prod`
- [ ] Set minimal API prod env values in `.env.docker.api.prod`:
  - `NODE_ENV=production`
  - `SERVER_HOST=<PI_IP>`
  - `SERVER_PROTOCOL=http`
  - `SERVER_PORT=8080`
  - `VIDEO_SOURCE_PROFILE=gdrive`
  - `VIDEO_PATH=/mnt-host/gdrive-videos`
  - `VIDEO_PATH_GDRIVE=/mnt-host/gdrive-videos`
  - `MOVIES_DIR=Movies`
  - `SERIES_DIR=Series`
  - `COOKIE_SECURE=false`
- [ ] Set minimal Web prod env values in `.env.docker.web.prod`:
  - `NODE_ENV=production`
  - `REACT_APP_SERVER_PROTOCOL=http`
  - `REACT_APP_SERVER_HOST=<PI_IP>`
- [ ] Configure `rclone` remote:
  - `rclone config`
  - verify with `rclone listremotes` (must include `gdrive:`)
- [ ] Create mount point and mount Google Drive manually:
  - `sudo mkdir -p /mnt/gdrive-videos`
  - `sudo chown $USER:$USER /mnt/gdrive-videos`
  - `rclone mount gdrive: /mnt/gdrive-videos --allow-other --vfs-cache-mode full`
- [ ] In another terminal, verify mounted media layout:
  - `ls -la /mnt/gdrive-videos`
  - `ls -la /mnt/gdrive-videos/Movies`
  - `ls -la /mnt/gdrive-videos/Series`
- [ ] Generate admin bcrypt hash secret (required for login):
  - automatic via preflight:
    - `ADMIN_PASSWORD_PLAIN="<strong-password>" ./scripts/pi/preflight-prod.sh`
  - manual (explicit bcrypt generation):
    - `mkdir -p secrets`
    - `npm --prefix apps/api ci`
    - `npm --prefix apps/api run -s hash:password -- "<strong-password>" > secrets/admin_password_hash`
    - `chmod 600 secrets/admin_password_hash`
- [ ] Run preflight for manual prod startup:
  - `./scripts/pi/preflight-prod.sh`
- [ ] Start app manually:
  - `docker compose --profile prod up -d --build api web`
- [ ] Verify app:
  - `docker compose --profile prod ps`
  - `curl -I http://localhost:3000`
  - open `http://<PI_IP>:3000`

## Important Notes

- Without `systemd`, the `rclone mount` is not persistent on reboot.
- Keep the terminal/session running where `rclone mount` is running, or remount manually after restart.
- Preflight validates `secrets/admin_password_hash` and checks bcrypt format.

## Auth Notes (Why This Secret File Exists)

- JWT is used for authentication:
  - access token for protected requests
  - refresh token to issue new access tokens
- For simplicity in this project, the admin password is configured via a bcrypt hash stored in:
  - `secrets/admin_password_hash`
- This file is mounted into the API container as:
  - `/run/secrets/admin_password_hash`

If preflight prints:

```text
Missing secret file: .../secrets/admin_password_hash
```

create it with one of the commands above, then run:

```bash
./scripts/pi/preflight-prod.sh
```

### Proper Production Scenario

- Use HTTPS end-to-end (reverse proxy + valid TLS cert).
- Keep `COOKIE_SECURE=true` in HTTPS deployments.
- Store JWT secrets and admin hash in a proper secret manager or orchestrator secrets:
  - Docker Swarm/Kubernetes secrets, Vault, AWS/GCP/Azure secret services.
- Restrict secret access by least privilege.
- Rotate secrets periodically and after incidents.
- Avoid storing secrets in git-tracked files or plaintext env files.

## Next Step (Optional)

When manual startup is stable, move to:

- [Pi one-click bootstrap](./pi-one-click-bootstrap.md)

for reboot-safe startup with services.
