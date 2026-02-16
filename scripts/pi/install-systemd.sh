#!/usr/bin/env bash
# Purpose: render and install systemd units for
# rclone mount + Home Video compose stack auto-start on reboot.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as your normal user (not root). This script will use sudo when required."
  exit 1
fi

REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-3}"
PI_USER="${PI_USER:-$USER}"
PI_GROUP="${PI_GROUP:-$(id -gn "$PI_USER")}"
PI_HOME="${PI_HOME:-/home/$PI_USER}"
PROJECT_DIR="${PROJECT_DIR:-$REPO_ROOT}"
GDRIVE_MOUNT="${GDRIVE_MOUNT:-/mnt/gdrive-videos}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_CONFIG="${RCLONE_CONFIG:-$PI_HOME/.config/rclone/rclone.conf}"

echo "Running preflight checks..."
# Validate required files/tools before touching /etc/systemd/system.
require_cmd sed
require_cmd systemctl
require_cmd sudo
require_cmd mktemp
require_cmd cp
require_cmd grep
if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "PROJECT_DIR does not exist: $PROJECT_DIR"
  exit 1
fi
if [[ ! -f "$REPO_ROOT/deploy/systemd/rclone-gdrive.service" ]]; then
  echo "Missing template: $REPO_ROOT/deploy/systemd/rclone-gdrive.service"
  exit 1
fi
if [[ ! -f "$REPO_ROOT/deploy/systemd/home-video.service" ]]; then
  echo "Missing template: $REPO_ROOT/deploy/systemd/home-video.service"
  exit 1
fi
if [[ ! -f "$RCLONE_CONFIG" ]]; then
  echo "Rclone config file not found: $RCLONE_CONFIG"
  echo "Run 'rclone config' first."
  exit 1
fi
if ! grep -q "^\[$RCLONE_REMOTE\]" "$RCLONE_CONFIG"; then
  echo "Remote '$RCLONE_REMOTE' not found in $RCLONE_CONFIG"
  echo "Run 'rclone config' and create that remote."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

render_template() {
  local input="$1"
  local output="$2"
  # Render unit templates with user/path-specific values.
  sed \
    -e "s|__PI_USER__|$PI_USER|g" \
    -e "s|__PI_GROUP__|$PI_GROUP|g" \
    -e "s|__PI_HOME__|$PI_HOME|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__GDRIVE_MOUNT__|$GDRIVE_MOUNT|g" \
    -e "s|__RCLONE_REMOTE__|$RCLONE_REMOTE|g" \
    -e "s|__RCLONE_CONFIG__|$RCLONE_CONFIG|g" \
    "$input" >"$output"
}

render_template "$REPO_ROOT/deploy/systemd/rclone-gdrive.service" "$TMP_DIR/rclone-gdrive.service"
render_template "$REPO_ROOT/deploy/systemd/home-video.service" "$TMP_DIR/home-video.service"

echo "Installing systemd units..."
# Install concrete units into system location.
sudo cp "$TMP_DIR/rclone-gdrive.service" /etc/systemd/system/rclone-gdrive.service
sudo cp "$TMP_DIR/home-video.service" /etc/systemd/system/home-video.service

echo "Reloading systemd and enabling units..."
# Reload daemon and enable both services for reboot persistence.
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo systemctl daemon-reload
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo systemctl enable rclone-gdrive.service
retry "$RETRY_MAX" "$RETRY_DELAY_SECONDS" sudo systemctl enable home-video.service

cat <<EOF

Systemd units installed.
Use these commands:
  sudo systemctl start rclone-gdrive.service
  sudo systemctl start home-video.service
  sudo systemctl status rclone-gdrive.service
  sudo systemctl status home-video.service
EOF
