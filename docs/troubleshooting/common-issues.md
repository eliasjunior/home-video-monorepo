# Common Issues

[Back to root README](../../README.md)


## Frontend Calls `localhost` Instead of LAN IP

Cause:

- wrong frontend env file updated

Fix:

- set `REACT_APP_SERVER_HOST=<your-ip>` in the correct env file
- restart frontend runtime (CRA or Docker)

## Cookies Not Set in Local Dev

Fix:

- use `COOKIE_SECURE=false`
- use `COOKIE_SAMESITE=Lax`
- ensure frontend and API use the same host style (both IP or both localhost)

## 401 After Login on HTTP Production

Cause:

- production mode defaults secure cookies to `true`

Fix:

- set `COOKIE_SECURE=false` for HTTP deployments
- or switch to HTTPS and keep secure cookies enabled

## Docker Compose Bcrypt Hash Truncated

Cause:

- `$` in bcrypt hash interpreted as env interpolation

Fix:

- escape as `$$` in env files
- or use Docker secret for hash

## `rclone` Remote Errors

### `didn't find section in config file`

Fix: check remote names with:

```bash
rclone listremotes
```

### `unauthorized_client` or token fetch errors

Fix:

```bash
rclone config reconnect gdrive:
```

Ensure remote type is `drive`; recreate remote if needed.

### `Daemon timed out` on mount

Fix: run mount in foreground first to expose the real error:

```bash
rclone mount gdrive: /mnt/gdrive-videos --read-only --vfs-cache-mode full -vv
```

### Container `Permission denied` on mount

Fix:

- enable `user_allow_other` in `/etc/fuse.conf`
- use `--allow-other` on mount
- prefer `/mnt/...` host mount for Docker bind

## API Says `.../Movies does not exist or cannot access it`

Cause:

- wrong container path or bind mapping

Fix:

- container path should match API env (`/mnt-host/gdrive-videos` for gdrive profile)
- compose should bind `/mnt:/mnt-host:ro`
