#!/usr/bin/env bash
# Purpose: validate minimal prerequisites for manual Pi prod startup
# (mount path + auth secret) without bootstrap/systemd setup.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
SECRET_DIR="$REPO_ROOT/secrets"
SECRET_FILE="$SECRET_DIR/admin_password_hash"
API_ENV_FILE="$REPO_ROOT/.env.docker.api.prod"
WEB_ENV_FILE="$REPO_ROOT/.env.docker.web.prod"

RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as your normal user (not root)."
  exit 1
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This preflight is intended for Linux/Raspberry Pi hosts."
  exit 1
fi

echo "Running prod preflight checks..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Missing required command: docker"
  echo "Install with: sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Missing required command: npm"
  echo "Install with: sudo apt-get update && sudo apt-get install -y npm"
  echo "Or install with nodejs together: sudo apt-get update && sudo apt-get install -y nodejs npm"
  exit 1
fi

if ! command -v grep >/dev/null 2>&1; then
  echo "Missing required command: grep"
  echo "Install with: sudo apt-get update && sudo apt-get install -y grep"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is not available."
  exit 1
fi

if [[ ! -f "$API_ENV_FILE" ]]; then
  echo "Missing required env file: $API_ENV_FILE"
  exit 1
fi

if [[ ! -f "$WEB_ENV_FILE" ]]; then
  echo "Missing required env file: $WEB_ENV_FILE"
  exit 1
fi

if [[ ! -d "/mnt" ]]; then
  echo "Missing /mnt on host."
  echo "Prod compose expects '/mnt:/mnt-host:ro'."
  exit 1
fi

read_env_value() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | head -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi
  local value="${line#*=}"
  # Remove optional single/double wrapping quotes.
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  echo "$value"
}

IMAGE_FALLBACK_BASE_URL_VALUE="$(read_env_value "$API_ENV_FILE" "IMAGE_FALLBACK_BASE_URL")"
if [[ -z "$IMAGE_FALLBACK_BASE_URL_VALUE" ]]; then
  echo "Missing IMAGE_FALLBACK_BASE_URL in $API_ENV_FILE"
  echo "Expected format: IMAGE_FALLBACK_BASE_URL=http://<PI_IP>:8080/public"
  exit 1
fi
if [[ "$IMAGE_FALLBACK_BASE_URL_VALUE" == *"movie_fallback.png"* ]]; then
  echo "Invalid IMAGE_FALLBACK_BASE_URL in $API_ENV_FILE"
  echo "Do not include movie_fallback.png. Use only: http://<PI_IP>:8080/public"
  exit 1
fi
if [[ "$IMAGE_FALLBACK_BASE_URL_VALUE" != *"/public" ]]; then
  echo "Invalid IMAGE_FALLBACK_BASE_URL in $API_ENV_FILE: $IMAGE_FALLBACK_BASE_URL_VALUE"
  echo "Expected to end with /public (example: http://<PI_IP>:8080/public)"
  exit 1
fi

WEB_HOST_VALUE="$(read_env_value "$WEB_ENV_FILE" "REACT_APP_SERVER_HOST")"
WEB_PROTOCOL_VALUE="$(read_env_value "$WEB_ENV_FILE" "REACT_APP_SERVER_PROTOCOL")"
if [[ -z "$WEB_HOST_VALUE" ]]; then
  echo "Missing REACT_APP_SERVER_HOST in $WEB_ENV_FILE"
  echo "Set it to the Raspberry Pi LAN IP (example: 192.168.68.120)."
  exit 1
fi
if [[ "$WEB_HOST_VALUE" == "localhost" || "$WEB_HOST_VALUE" == "127.0.0.1" ]]; then
  echo "Invalid REACT_APP_SERVER_HOST in $WEB_ENV_FILE: $WEB_HOST_VALUE"
  echo "In production this must be the Raspberry Pi LAN IP, not localhost."
  exit 1
fi
if [[ "$WEB_PROTOCOL_VALUE" != "http" && "$WEB_PROTOCOL_VALUE" != "https" ]]; then
  echo "Invalid REACT_APP_SERVER_PROTOCOL in $WEB_ENV_FILE: $WEB_PROTOCOL_VALUE"
  echo "Allowed values: http or https"
  exit 1
fi

mkdir -p "$SECRET_DIR"
if [[ ! -s "$SECRET_FILE" ]]; then
  if [[ -z "${ADMIN_PASSWORD_PLAIN:-}" ]]; then
    echo "Missing secret file: $SECRET_FILE"
    echo "Set ADMIN_PASSWORD_PLAIN to generate it automatically."
    echo 'Example: ADMIN_PASSWORD_PLAIN="change-me" ./scripts/pi/preflight-prod.sh'
    exit 1
  fi

  if [[ ! -d "$API_DIR/node_modules/bcrypt" ]]; then
    echo "Installing API dependencies (required for hash generation)..."
    retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" npm --prefix "$API_DIR" ci
  fi

  echo "Generating bcrypt hash into $SECRET_FILE..."
  HASH="$(npm --prefix "$API_DIR" run -s hash:password -- "$ADMIN_PASSWORD_PLAIN" | tr -d '\r')"
  if [[ -z "$HASH" ]]; then
    echo "Hash generation returned empty output."
    exit 1
  fi

  umask 077
  printf "%s\n" "$HASH" > "$SECRET_FILE"
fi

if ! grep -Eq '^\$2[aby]\$[0-9]{2}\$' "$SECRET_FILE"; then
  echo "Invalid bcrypt hash format in $SECRET_FILE"
  echo 'Regenerate with: npm --prefix apps/api run hash:password -- "<password>"'
  exit 1
fi

echo "Preflight checks passed."
echo "Use this start command:"
echo "docker compose --env-file .env.docker.web.prod --profile prod up -d --build api web"
