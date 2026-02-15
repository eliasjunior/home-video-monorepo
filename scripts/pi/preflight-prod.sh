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

if [[ ! -d "/mnt" ]]; then
  echo "Missing /mnt on host."
  echo "Prod compose expects '/mnt:/mnt-host:ro'."
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
