# Agents Guide

This document defines how AI agents should interact with this project.
Agents must rely strictly on the provided context and tasks and must not
assume capabilities beyond what is explicitly stated.

---

## Base Context (Monorepo)

- This is a **monorepo** with:
  - `apps/api`: Node.js backend
  - `apps/web`: React frontend
- Project purpose:
  - Focused on gradual improvement (“baby steps”).
- Stability and clarity are more important than bleeding-edge features.
- Each app is expected to **run locally** after every change.

---

## Environment Constraints

- Agents:
  - ❌ cannot change Node versions
  - ❌ cannot elevate permissions
  - ❌ cannot change anything before asking permission.
- Human (me):
  - ✅ can run shell commands
  - ✅ can upgrade Node manually
  - ✅ can update and should update files withing the project context, ask confirmation
  - ✅ will paste back logs and errors

Agents must:
- Ask me to run commands when needed
- Provide **exact commands** to run
- Clearly explain why a command is required


## Frontend Context (apps/web)

- This is a **React SPA** (client for the API).
- Stability and clarity are more important than bleeding-edge changes.
- The app is expected to **run locally** after every change.
- Backend authentication uses **JWT access + refresh tokens**.

---

## Next Steps 

## Corrected Plan (SMB, not NFS)

### 1. SMB Provider Machine (`192.168.68.100`, HDD Pi)
- Keep static IP.
- Install Samba server (`samba`).
- Keep hard drive mounted persistently (existing `/media/pi/ExternalHD`).
- Export only media via Samba share (`[homevideo]`) as read-only.
- Restrict share access to API host IP (`192.168.68.120`) and valid user (`apireader`).
- Enable/start `smbd` on boot with `systemctl`.
- Optional: firewall allow SMB only from `192.168.68.120`.

### 2. API Host (`192.168.68.120`)
- Install SMB client tools (`cifs-utils`).
- Create local mountpoint (`/mnt/homevideo-smb`).
- Add CIFS mount to `/etc/fstab`:
  - `//192.168.68.100/homevideo -> /mnt/homevideo-smb` (read-only).
- Use credentials file (`/etc/samba/credentials/homevideo`, `chmod 600`).
- Test mount/read access and ensure remount on reboot.

### 3. Docker / Compose
- Bind mount host path into API container:
  - `/mnt/homevideo-smb:/mnt-host/homevideo-smb:ro`
- Mount only in `api-prod` service (not `web-prod`).
- Update API env:
  - `VIDEO_SOURCE_PROFILE=local`
  - `VIDEO_PATH_LOCAL=/mnt-host/homevideo-smb/Cine`
  - `MOVIES_DIR=Movies`
  - `SERIES_DIR=Series`

### 4. API Code Changes
- No mandatory code change (API already reads filesystem path via env).
- Optional:
  - startup check for `videosPath` readability,
  - clearer error when mount/share unavailable,
  - docs update for SMB deployment.

### 5. Security / Access Scope
- Samba share restricted by:
  - `hosts allow = 192.168.68.120`
  - `valid users = apireader`
  - `read only = yes`
- Optional firewall on `192.168.68.100` to allow SMB only from `192.168.68.120`.
- Only `api-prod` container receives media volume.
- Keep mount and container bind as read-only.



## Status Summary

### Objective
Enable the API host (`192.168.68.120`) to read media from the HDD attached to another Raspberry Pi (`192.168.68.100`) using read-only, backend-restricted access.

### Key Decisions
- The HDD on `192.168.68.100` uses `hfsplus` (legacy macOS filesystem).
- Kernel NFS export was not viable (`does not support NFS export`).
- The solution was switched to SMB read-only, which is compatible and non-destructive.

### Implemented on Media Host (`192.168.68.100`)
- Samba server installed and running (`smbd`).
- Dedicated SMB account configured: `apireader`.
- Share `[homevideo]` configured for `/media/pi/ExternalHD` with:
  - read-only access,
  - authenticated access (`valid users = apireader`),
  - IP restriction to backend host.
- SMB service confirmed listening on TCP `445`.

### Implemented on API Host (`192.168.68.120`)
- CIFS client tools installed.
- Credentials file created: `/etc/samba/credentials/homevideo`.
- Persistent mount configured in `/etc/fstab`:
  - `//192.168.68.100/homevideo` -> `/mnt/homevideo-smb`
  - read-only mount options.
- Mount verified as active via `mount | grep homevideo-smb`.
- Media structure validated under:
  - `/mnt/homevideo-smb/Cine/Movies`
  - `/mnt/homevideo-smb/Cine/Series`

### Current Result
- Cross-machine read-only media access is working.
- API host can read HDD content through the mounted SMB path.
- No disk formatting or data migration was performed.

### Remaining Tasks
1. Update Docker Compose so API container receives the mounted path (read-only).
2. Set API environment values:
   - `VIDEO_SOURCE_PROFILE=local`
   - `VIDEO_PATH_LOCAL=/mnt-host/homevideo-smb/Cine`
   - `MOVIES_DIR=Movies`
   - `SERIES_DIR=Series`
3. Restart API container and validate endpoints:
   - `GET /videos`
   - `GET /series`
4. Optional hardening:
   - clean stale `/etc/fstab` entries,
   - backup final `smb.conf` and `fstab`,
   - reboot both Pis and verify auto-start behavior.

