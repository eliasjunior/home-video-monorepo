#!/usr/bin/env bash
set -euo pipefail

REPO="/home/gandalf/Projects/home-video-monorepo"
COMPOSE="$REPO/docker-compose.yml"
VIDEO_DIR="/home/gandalf/Videos"

if [ ! -f "$COMPOSE" ]; then
  echo "ERROR: docker-compose.yml not found at $COMPOSE"
  exit 1
fi

echo "This will update $COMPOSE (volume path + web port), ensure video folders, and recreate prod containers."
read -r -p "Continue? [y/N]: " CONFIRM
case "${CONFIRM:-}" in
  y|Y) ;;
  *)
    echo "Aborted."
    exit 0
    ;;
 esac

echo "==> Fixing volume paths in docker-compose.yml"
# Replace any Videos:/videos host path with the Pi path
sed -i.bak 's|/.*Videos:/videos|/home/gandalf/Videos:/videos|' "$COMPOSE"

# Ensure prod web maps to nginx port 80
sed -i.bak '/^  web:$/,/^  [a-z]/ s/"3000:3000"/"3000:80"/' "$COMPOSE"

echo "==> Ensuring video folders exist"
mkdir -p "$VIDEO_DIR/Movies/TestMovie"
mkdir -p "$VIDEO_DIR/Series"

echo "==> Recreating prod containers"
cd "$REPO"
docker compose --profile prod up --build -d --force-recreate

API_CID="$(docker compose --profile prod ps -q api || true)"
if [ -z "$API_CID" ]; then
  API_CID="$(docker ps --filter "name=home-video-monorepo-api" -q | head -n 1 || true)"
fi

echo "==> Verifying web server"
if ! curl -I http://localhost:3000; then
  echo "WARNING: FE check failed on http://localhost:3000"
fi

echo "==> Verifying API container video mount"
if [ -n "$API_CID" ]; then
  docker exec -it "$API_CID" sh -c "ls -la /videos && ls -la /videos/Movies"
else
  echo "WARNING: Could not find API container to verify /videos"
fi

PI_IP="$(hostname -I | awk '{print $1}')"
if [ -n "$PI_IP" ]; then
  echo "==> Open in browser: http://$PI_IP:3000"
fi

echo "Done."
