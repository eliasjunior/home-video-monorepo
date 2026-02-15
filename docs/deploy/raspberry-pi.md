# Raspberry Pi Deployment

[Back to root README](../../README.md)


This page covers Docker-based production deployment on Raspberry Pi.

For a minimal manual run (no bootstrap/scripts/services), use:

- [Pi basic startup (manual)](pi-basic-startup.md)

For fresh machine provisioning and reboot-safe startup, use:

- [Pi one-click bootstrap](pi-one-click-bootstrap.md)

## Production Compose

Recreate prod services after config changes:

```bash
docker compose --env-file .env.docker.web.prod --profile prod down
docker compose --env-file .env.docker.web.prod --profile prod up -d --build api web
```

## Web Port Mapping

The web container serves nginx on internal port `80`.

Use mapping like:

- `"3000:80"`

## Local-Disk Video Layout (Legacy Path)

If you still use local disk videos on Pi:

- bind host video path into API container (for example `/home/<user>/Videos:/videos`)
- ensure folder structure exists:

```bash
mkdir -p /home/<user>/Videos/Movies/TestMovie
mkdir -p /home/<user>/Videos/Series
```

## Verification

Check frontend response:

```bash
curl -I http://localhost:3000
```

Check API container can see media folders:

```bash
docker exec -it home-video-monorepo-api-1 sh -c "ls -la /videos && ls -la /videos/Movies"
```

Access from another device:

```text
http://<PI-IP>:3000
```

## Related

- [Google Drive with `rclone`](../storage/google-drive-rclone.md)
- [Common issues](../troubleshooting/common-issues.md)
