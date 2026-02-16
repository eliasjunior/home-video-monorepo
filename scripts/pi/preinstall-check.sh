#!/usr/bin/env bash
# Purpose: validate/install base Raspberry Pi dependencies in sequence
# (git first, then runtime packages like Docker, rclone, and compose plugin).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

INSTALL_MISSING="${INSTALL_MISSING:-false}"
RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as your normal user (not root). This script will use sudo when required."
  exit 1
fi

echo "Running pre-install checks..."
require_cmd sudo
require_cmd apt-get
require_cmd dpkg
require_cmd systemctl
require_cmd grep

# Install order is explicit: git first, then the rest.
PACKAGES=(
  "git"
  "ca-certificates"
  "curl"
  "fuse3"
  "rclone"
  "docker.io"
  "docker-compose-plugin"
)

MISSING=()

is_pkg_installed() {
  local pkg="$1"
  dpkg -s "$pkg" >/dev/null 2>&1
}

install_pkg() {
  local pkg="$1"
  echo "Installing missing package: $pkg"
  retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo apt-get install -y "$pkg"
}

echo "Refreshing apt index..."
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo apt-get update

for pkg in "${PACKAGES[@]}"; do
  if is_pkg_installed "$pkg"; then
    echo "[ok] $pkg"
    continue
  fi

  echo "[missing] $pkg"
  MISSING+=("$pkg")
  if [[ "$INSTALL_MISSING" == "true" ]]; then
    install_pkg "$pkg"
  fi
done

if [[ "${#MISSING[@]}" -gt 0 && "$INSTALL_MISSING" != "true" ]]; then
  echo
  echo "Missing packages found. Re-run with INSTALL_MISSING=true to install in order."
  printf 'Missing: %s\n' "${MISSING[*]}"
  exit 1
fi

echo "Verifying runtime commands..."
require_cmd git
require_cmd rclone
require_cmd docker

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is not available."
  exit 1
fi

if ! systemctl list-unit-files | grep -q "^docker.service"; then
  echo "docker.service is not present after installation."
  exit 1
fi

echo "Pre-install check completed successfully."
