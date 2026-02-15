#!/usr/bin/env bash
# Purpose: deploy production containers with Docker Compose
# using bounded retries for transient build/pull failures.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-8}"

echo "Running preflight checks..."
# Verify Docker is reachable before compose actions.
require_cmd docker
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not available. Start docker first."
  exit 1
fi

if [[ ! -f "$REPO_ROOT/docker-compose.yml" ]]; then
  echo "docker-compose.yml not found at $REPO_ROOT"
  exit 1
fi

cd "$REPO_ROOT"

echo "Building and starting prod services..."
# Retry helps with transient image pull/build network failures.
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" \
  docker compose --env-file .env.docker.web.prod --profile prod up -d --build api web

echo
echo "Services started. Quick checks:"
echo "  docker compose --env-file .env.docker.web.prod --profile prod ps"
echo "  curl -I http://localhost:3000"
