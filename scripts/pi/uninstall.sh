#!/usr/bin/env bash
# Purpose: reset Raspberry Pi host state for this project
# (stop services, remove docker/rclone packages, delete project dir) in one command.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as your normal user (not root). This script will use sudo when required."
  exit 1
fi

CONFIRM_RESET="${CONFIRM_RESET:-}"
RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"
PI_USER="${PI_USER:-$USER}"
PI_HOME="${PI_HOME:-/home/$PI_USER}"
PROJECT_DIR="${PROJECT_DIR:-$PI_HOME/Projects/home-video-monorepo}"
GDRIVE_MOUNT="${GDRIVE_MOUNT:-/mnt/gdrive-videos}"
KEEP_RCLONE_CONFIG="${KEEP_RCLONE_CONFIG:-true}"
REMOVE_GDRIVE_MOUNT_DIR="${REMOVE_GDRIVE_MOUNT_DIR:-true}"

if [[ "$CONFIRM_RESET" != "YES" ]]; then
  echo "This is destructive and will remove Docker, rclone package, and project files."
  echo "To continue, run:"
  echo "  CONFIRM_RESET=YES ./scripts/pi/uninstall.sh"
  exit 1
fi

echo "Running uninstall preflight checks..."
require_cmd sudo
require_cmd systemctl
require_cmd apt-get
require_cmd rm
require_cmd grep

stop_disable_unit_if_exists() {
  local unit="$1"
  if systemctl list-unit-files | grep -q "^${unit}"; then
    echo "Stopping $unit"
    sudo systemctl stop "$unit" || true
    echo "Disabling $unit"
    sudo systemctl disable "$unit" || true
  fi
}

echo "[1/8] Stopping project services..."
stop_disable_unit_if_exists "home-video.service"
stop_disable_unit_if_exists "rclone-gdrive.service"

echo "[2/8] Attempting to stop compose stack (if available)..."
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1 && [[ -f "$PROJECT_DIR/docker-compose.yml" ]]; then
    (cd "$PROJECT_DIR" && docker compose --profile prod down) || true
  fi
fi

echo "[3/8] Removing systemd unit files..."
sudo rm -f /etc/systemd/system/home-video.service
sudo rm -f /etc/systemd/system/rclone-gdrive.service
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo systemctl daemon-reload

echo "[4/8] Purging Docker/rclone packages..."
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo apt-get purge -y docker-compose-plugin docker.io containerd runc rclone
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo apt-get autoremove -y

echo "[5/8] Deleting Docker data directories..."
sudo rm -rf /var/lib/docker /var/lib/containerd

echo "[6/8] Removing project directory..."
sudo rm -rf "$PROJECT_DIR"

echo "[7/8] Cleaning project mount directory..."
if [[ "$REMOVE_GDRIVE_MOUNT_DIR" == "true" ]]; then
  sudo rm -rf "$GDRIVE_MOUNT"
fi

echo "[8/8] Handling rclone config..."
if [[ "$KEEP_RCLONE_CONFIG" == "true" ]]; then
  echo "Keeping rclone config at $PI_HOME/.config/rclone"
else
  sudo rm -rf "$PI_HOME/.config/rclone"
fi

echo
echo "Uninstall/reset completed."
