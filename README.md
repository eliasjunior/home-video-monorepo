# Home Video (Monorepo)

Home Video is a small self-hosted app for streaming personal videos over a local network.

This repository is the monorepo version of the project and contains the current source of truth for API, Web, and docs.

## Project Structure

- `apps/web`: React frontend
- `apps/api`: Node.js backend
- `docs`: Monorepo documentation

## Quick Start (Local Dev)

Install dependencies:

```bash
npm install
```

Run both apps:

```bash
npm run dev
```

## Service URLs

- Frontend dev server: `http://localhost:3000`
- API: `http://localhost:8080`

## Documentation

- Monorepo docs index: [`docs/README.md`](docs/README.md)
- Local dev: [`docs/setup/local-dev.md`](docs/setup/local-dev.md)
- Raspberry Pi basic startup (manual): [`docs/deploy/pi-basic-startup.md`](docs/deploy/pi-basic-startup.md)
- Raspberry Pi deploy: [`docs/deploy/raspberry-pi.md`](docs/deploy/raspberry-pi.md)
- Google Drive + `rclone`: [`docs/storage/google-drive-rclone.md`](docs/storage/google-drive-rclone.md)
- Backend media scanning: [`docs/backend/media-scanning.md`](docs/backend/media-scanning.md)
- Authentication: [`docs/auth/authentication.md`](docs/auth/authentication.md)
- Troubleshooting: [`docs/troubleshooting/common-issues.md`](docs/troubleshooting/common-issues.md)

## Legacy Docs

The previous polyrepo docs are kept for historical context:

- [home-video-docs](https://github.com/eliasjunior/home-video-docs)

Monorepo docs should be preferred when instructions conflict.
