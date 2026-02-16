# Local Development

[Back to root README](../../README.md)


## Prerequisites

- Node.js installed (use the version already used by this monorepo)
- npm available

## Install and Run

From repository root:

```bash
npm install
npm run dev
```

## Environment Files

Frontend env selection depends on runtime mode:

- non-Docker dev (CRA): `apps/web/.env.development`
- Docker dev compose:
  - API: `.env.docker.api.dev`
  - Web: `.env.docker.web.dev`

If frontend still calls `localhost` unexpectedly, update the correct env file and restart.

## Docker Development (Profile `dev`)

Run all commands from repository root.

### Start Dev Stack

Build and run in foreground:

```bash
docker compose --profile dev up --build
```

Build and run in background:

```bash
docker compose --profile dev up -d --build
```

Start without rebuilding:

```bash
docker compose --profile dev up -d
```

### Stop Dev Stack

Stop and remove containers/networks:

```bash
docker compose --profile dev down
```

Stop and remove containers/networks/volumes:

```bash
docker compose --profile dev down -v
```

### Common Day-to-Day Commands

Show running services:

```bash
docker compose --profile dev ps
```

Follow logs from all services:

```bash
docker compose --profile dev logs -f
```

Follow logs for API only:

```bash
docker compose --profile dev logs -f api
```

Follow logs for Web only:

```bash
docker compose --profile dev logs -f web
```

Restart both services:

```bash
docker compose --profile dev restart api web
```

Rebuild only one service:

```bash
docker compose --profile dev up -d --build api
docker compose --profile dev up -d --build web
```

Open a shell inside API container:

```bash
docker compose --profile dev exec api sh
```

Open a shell inside Web container:

```bash
docker compose --profile dev exec web sh
```

## Frontend and API URLs

- frontend: `http://localhost:3000`
- API: `http://localhost:8080`

## Run Apps in Isolation

Frontend only:

```bash
cd apps/web
npm install
npm run dev
```

Backend only:

```bash
cd apps/api
npm install
npm test
npm run dev
```
