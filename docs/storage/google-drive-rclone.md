# Google Drive with rclone

[Back to root README](../../README.md)


The API reads local filesystem paths. Google Drive support is done by mounting Drive with `rclone` on the host and exposing that mount to Docker.

Replace `home-user` with your actual Linux username.

## 1) Configure `rclone` Remote

```bash
rclone config
```

Notes:

- use remote type `drive` (Google Drive), not `onedrive`
- in headless/SSH mode, set `Use auto config?` to `n`
- finish auth with:

```bash
rclone authorize "drive" "TOKEN_HERE"
```

## 2) Mount Drive Read-Only

One-time FUSE setting for Docker visibility:

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

## 3) Docker and API Env Wiring

`docker-compose.yml` (`api` service):

```yaml
volumes:
  - /mnt:/mnt-host:ro
```

`.env.docker.api.prod`:

```env
VIDEO_SOURCE_PROFILE=gdrive
VIDEO_PATH=/mnt-host/gdrive-videos
VIDEO_PATH_GDRIVE=/mnt-host/gdrive-videos
MOVIES_DIR=Movies
SERIES_DIR=Series
```

Recreate services:

```bash
docker compose --profile prod down
docker compose --profile prod up -d --build api web
```

Verify inside API container:

```bash
docker compose --profile prod exec api sh -lc 'ls -la /mnt-host/gdrive-videos && ls -la /mnt-host/gdrive-videos/Movies'
```

## 4) Required Media Layout

Supported movie layouts:

```text
<VIDEO_PATH>/Movies/<MovieFolder>/<videoFile>
<VIDEO_PATH>/Movies/<videoFile>
```

Both folder-based and flat file layouts are supported.

See [backend media scanning](../backend/media-scanning.md).
