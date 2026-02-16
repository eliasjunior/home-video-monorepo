#!/usr/bin/env bash
# Purpose: prepare a fresh Raspberry Pi host
# (install dependencies, enable Docker, configure FUSE, create mount dirs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as your normal user (not root). This script will use sudo when required."
  exit 1
fi

RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"
PI_USER="${PI_USER:-$USER}"
PI_GROUP="${PI_GROUP:-$(id -gn "$PI_USER")}"
PI_HOME="${PI_HOME:-/home/$PI_USER}"
PROJECT_DIR="${PROJECT_DIR:-$PI_HOME/Projects/home-video-monorepo}"
GDRIVE_MOUNT="${GDRIVE_MOUNT:-/mnt/gdrive-videos}"

echo "Running preflight checks..."
# Fail early when core host tools are unavailable.
require_cmd sudo
require_cmd systemctl
require_cmd grep
require_cmd tee
if [[ ! -d "$PI_HOME" ]]; then
  echo "PI_HOME does not exist: $PI_HOME"
  exit 1
fi

echo "[1/5] Installing required OS packages..."
# Install sequence and command verification are handled by the preinstall script.
INSTALL_MISSING=true RETRY_MAX="$RETRY_MAX" RETRY_DELAY_SECONDS="$RETRY_DELAY_SECONDS" \
  "$SCRIPT_DIR/preinstall-check.sh"

echo "[2/5] Enabling docker on boot..."
sudo systemctl enable docker
sudo systemctl start docker

echo "[3/5] Allowing current user to run docker..."
# Requires new shell/login to refresh group membership.
sudo usermod -aG docker "$PI_USER"

echo "[4/5] Enabling FUSE allow_other..."
# Needed so Docker containers can read rclone mount bind paths.
if ! grep -q '^user_allow_other$' /etc/fuse.conf; then
  echo 'user_allow_other' | sudo tee -a /etc/fuse.conf >/dev/null
fi

echo "[5/5] Creating required folders..."
mkdir -p "$PROJECT_DIR"
sudo mkdir -p "$GDRIVE_MOUNT"
sudo chown "$PI_USER:$PI_GROUP" "$GDRIVE_MOUNT"

cat <<EOF

Bootstrap complete.
Next steps:
1) Configure rclone remote:
   rclone config
2) Install project services:
   PROJECT_DIR="$PROJECT_DIR" PI_USER="$PI_USER" PI_GROUP="$PI_GROUP" GDRIVE_MOUNT="$GDRIVE_MOUNT" ./scripts/pi/install-systemd.sh
3) Fill prod env + secret:
   ./scripts/pi/configure.sh
4) Deploy:
   ./scripts/pi/deploy.sh

Note: run 'newgrp docker' (or log out/in) before using docker without sudo.
EOF
