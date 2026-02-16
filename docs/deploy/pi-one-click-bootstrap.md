# Raspberry Pi One-Click Bootstrap

[Back to root README](../../README.md)


This guide sets up a fresh Raspberry Pi to auto-start:

1. `rclone` mount (`gdrive:` -> `/mnt/gdrive-videos`)
2. Home Video Docker Compose stack (`api` + `web`)

After setup, both services start automatically on reboot.

The scripts are fail-fast with bounded retries (default `3`) and no infinite loops.
You can override retries with `RETRY_MAX` and `RETRY_DELAY_SECONDS`.

## Optional: Full Reset (Start Over)

Use this when you want to remove project-level Pi setup and reinstall from scratch.
By default it keeps your `rclone` Google Drive config.

```bash
CONFIRM_RESET=YES ./scripts/pi/uninstall.sh
```

Optional flags:

```bash
KEEP_RCLONE_CONFIG=false CONFIRM_RESET=YES ./scripts/pi/uninstall.sh
```

## 0) Clone Repository

```bash
mkdir -p /home/<user>/Projects
cd /home/<user>/Projects
git clone <your-repo-url> home-video-monorepo
cd home-video-monorepo
```

## 1) Bootstrap Host Dependencies

This installs Docker, compose plugin, `rclone`, FUSE, and enables Docker at boot.

```bash
chmod +x scripts/pi/*.sh
./scripts/pi/bootstrap.sh
```

You can also run dependency checks only (no installation):

```bash
./scripts/pi/preinstall-check.sh
```

## 2) Configure `rclone`

Create remote `gdrive`:

```bash
rclone config
```

Verify:

```bash
rclone listremotes
```

Expected output includes:

```text
gdrive:
```

## 3) Install `systemd` Units

```bash
PROJECT_DIR=/home/<user>/Projects/home-video-monorepo \
PI_USER=<user> \
PI_GROUP=<user-group> \
GDRIVE_MOUNT=/mnt/gdrive-videos \
RCLONE_REMOTE=gdrive \
./scripts/pi/install-systemd.sh
```

## 4) Configure App Env + Secret

Set your Raspberry Pi LAN IP and admin hash:

```bash
PI_IP=<pi-lan-ip> ADMIN_PASSWORD_HASH='<bcrypt-hash>' ./scripts/pi/configure.sh
```

If you do not provide `ADMIN_PASSWORD_HASH`, update:

```bash
secrets/admin_password_hash
```

before deployment.

## 5) First Start

```bash
sudo systemctl start rclone-gdrive.service
sudo systemctl start home-video.service
```

## Optional: Single Command Runner (Checkpoint/Resume)

This wraps bootstrap + systemd + configure + deploy and records completed steps in:

```text
.pi-bootstrap-state
```

Run:

```bash
PI_IP=<pi-lan-ip> ADMIN_PASSWORD_HASH='<bcrypt-hash>' ./scripts/pi/first-run.sh
```

If a step fails, fix the issue and re-run the same command. Completed steps are skipped.

## 6) Verify

```bash
sudo systemctl status rclone-gdrive.service
sudo systemctl status home-video.service
docker compose --profile prod ps
curl -I http://localhost:3000
```

From another device on LAN:

```text
http://<pi-lan-ip>:3000
```

## Reboot Test

```bash
sudo reboot
```

After reboot:

```bash
sudo systemctl status rclone-gdrive.service
sudo systemctl status home-video.service
```

## Notes

- Keep a DHCP reservation/static IP for the Pi.
- For HTTP deployment, keep `COOKIE_SECURE=false`.
- If `rclone` mount fails, run troubleshooting from:
  - `docs/storage/google-drive-rclone.md`
  - `docs/troubleshooting/common-issues.md`
