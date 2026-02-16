#!/usr/bin/env bash
# Purpose: configure production env files and Docker secret
# (Pi IP wiring, HTTP cookie settings, gdrive path/profile, admin hash file).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

API_ENV="$REPO_ROOT/.env.docker.api.prod"
WEB_ENV="$REPO_ROOT/.env.docker.web.prod"
SECRET_FILE="$REPO_ROOT/secrets/admin_password_hash"
GDRIVE_CONTAINER_PATH="${GDRIVE_CONTAINER_PATH:-/mnt-host/gdrive-videos}"

if [[ "${PI_IP:-}" == "" ]]; then
  echo "PI_IP is required. Example:"
  echo '  PI_IP=192.168.68.120 ./scripts/pi/configure.sh'
  exit 1
fi

RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-3}"

echo "Running preflight checks..."
# Ensure we can safely mutate env files and that PI_IP is sane.
require_cmd sed
require_cmd cp
require_cmd chmod
require_cmd mkdir
if ! is_ipv4 "$PI_IP"; then
  echo "PI_IP is not a valid IPv4 address: $PI_IP"
  exit 1
fi

mkdir -p "$REPO_ROOT/secrets"

if [[ ! -f "$API_ENV" ]]; then
  # Seed prod env from dev template when prod file does not exist yet.
  retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" cp "$REPO_ROOT/.env.docker.api.dev" "$API_ENV"
fi

if [[ ! -f "$WEB_ENV" ]]; then
  retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" cp "$REPO_ROOT/.env.docker.web.dev" "$WEB_ENV"
fi

echo "Configuring prod env files for PI_IP=$PI_IP ..."
# Force production-safe values and gdrive source profile for Pi deployment.
upsert_env "$WEB_ENV" "NODE_ENV" "production"
upsert_env "$WEB_ENV" "REACT_APP_SERVER_HOST" "$PI_IP"
upsert_env "$WEB_ENV" "REACT_APP_SERVER_PROTOCOL" "http"

upsert_env "$API_ENV" "NODE_ENV" "production"
upsert_env "$API_ENV" "SERVER_HOST" "$PI_IP"
upsert_env "$API_ENV" "SERVER_PROTOCOL" "http"
upsert_env "$API_ENV" "SERVER_PORT" "8080"
upsert_env "$API_ENV" "IMAGES_HOST_SERVER" "$PI_IP"
upsert_env "$API_ENV" "IMAGES_PORT_SERVER" "8080"
upsert_env "$API_ENV" "IMAGE_FALLBACK_BASE_URL" "http://$PI_IP:8080/public"
upsert_env "$API_ENV" "COOKIE_SECURE" "false"
upsert_env "$API_ENV" "VIDEO_SOURCE_PROFILE" "gdrive"
upsert_env "$API_ENV" "VIDEO_PATH" "$GDRIVE_CONTAINER_PATH"
upsert_env "$API_ENV" "VIDEO_PATH_GDRIVE" "$GDRIVE_CONTAINER_PATH"
upsert_env "$API_ENV" "MOVIES_DIR" "Movies"
upsert_env "$API_ENV" "SERIES_DIR" "Series"
upsert_env "$API_ENV" "CORS_ORIGIN" "http://localhost:3000,http://$PI_IP:3000"

if [[ "${ADMIN_PASSWORD_HASH:-}" != "" ]]; then
  # Prefer docker secret file to avoid bcrypt escaping issues in env files.
  printf '%s' "$ADMIN_PASSWORD_HASH" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "Wrote $SECRET_FILE"
else
  cat <<EOF
ADMIN_PASSWORD_HASH not provided, so $SECRET_FILE was not changed.
If needed:
  PI_IP=$PI_IP ADMIN_PASSWORD_HASH='<bcrypt-hash>' ./scripts/pi/configure.sh
EOF
fi

echo "Done. Review and remove *.bak files when satisfied."
