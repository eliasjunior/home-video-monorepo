#!/usr/bin/env bash
# Purpose: orchestrate first-time Pi provisioning end-to-end
# with checkpoint/resume support via .pi-bootstrap-state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

STATE_FILE="${STATE_FILE:-$REPO_ROOT/.pi-bootstrap-state}"
PI_USER="${PI_USER:-$USER}"
PI_GROUP="${PI_GROUP:-$(id -gn "$PI_USER")}"
PI_HOME="${PI_HOME:-/home/$PI_USER}"
PROJECT_DIR="${PROJECT_DIR:-$REPO_ROOT}"
GDRIVE_MOUNT="${GDRIVE_MOUNT:-/mnt/gdrive-videos}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_CONFIG="${RCLONE_CONFIG:-$PI_HOME/.config/rclone/rclone.conf}"
RETRY_MAX="${RETRY_MAX:-3}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-5}"

if [[ "${PI_IP:-}" == "" ]]; then
  echo "PI_IP is required. Example:"
  echo "  PI_IP=192.168.68.120 ./scripts/pi/first-run.sh"
  exit 1
fi

if ! is_ipv4 "$PI_IP"; then
  echo "PI_IP is not a valid IPv4 address: $PI_IP"
  exit 1
fi

touch "$STATE_FILE"

is_done() {
  local step="$1"
  grep -q "^${step}=done$" "$STATE_FILE"
}

mark_done() {
  local step="$1"
  if ! is_done "$step"; then
    echo "${step}=done" >> "$STATE_FILE"
  fi
}

run_step() {
  local step="$1"
  shift

  # Resume support: skip steps previously marked as completed.
  if is_done "$step"; then
    echo "Skipping completed step: $step"
    return 0
  fi

  echo "Running step: $step"
  "$@"
  # Mark only after successful completion.
  mark_done "$step"
}

check_rclone_remote() {
  if [[ ! -f "$RCLONE_CONFIG" ]]; then
    echo "Missing rclone config: $RCLONE_CONFIG"
    echo "Run: rclone config"
    return 1
  fi

  grep -q "^\[$RCLONE_REMOTE\]" "$RCLONE_CONFIG" || {
    echo "Remote '$RCLONE_REMOTE' not found in $RCLONE_CONFIG"
    echo "Run: rclone config"
    return 1
  }
}

run_step "bootstrap" env \
  PI_USER="$PI_USER" PI_GROUP="$PI_GROUP" PI_HOME="$PI_HOME" PROJECT_DIR="$PROJECT_DIR" \
  GDRIVE_MOUNT="$GDRIVE_MOUNT" RETRY_MAX="$RETRY_MAX" RETRY_DELAY_SECONDS="$RETRY_DELAY_SECONDS" \
  "$SCRIPT_DIR/bootstrap.sh"

run_step "rclone_remote_check" check_rclone_remote

run_step "install_systemd" env \
  PI_USER="$PI_USER" PI_GROUP="$PI_GROUP" PI_HOME="$PI_HOME" PROJECT_DIR="$PROJECT_DIR" \
  GDRIVE_MOUNT="$GDRIVE_MOUNT" RCLONE_REMOTE="$RCLONE_REMOTE" RCLONE_CONFIG="$RCLONE_CONFIG" \
  RETRY_MAX="$RETRY_MAX" RETRY_DELAY_SECONDS="$RETRY_DELAY_SECONDS" \
  "$SCRIPT_DIR/install-systemd.sh"

run_step "configure" env \
  PI_IP="$PI_IP" ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-}" \
  GDRIVE_CONTAINER_PATH="${GDRIVE_CONTAINER_PATH:-/mnt-host/gdrive-videos}" \
  RETRY_MAX="$RETRY_MAX" RETRY_DELAY_SECONDS="$RETRY_DELAY_SECONDS" \
  "$SCRIPT_DIR/configure.sh"

run_step "deploy" env \
  RETRY_MAX="$RETRY_MAX" RETRY_DELAY_SECONDS="$RETRY_DELAY_SECONDS" \
  "$SCRIPT_DIR/deploy.sh"

echo
echo "First-run completed."
echo "State file: $STATE_FILE"
echo "Start services now (if not running):"
echo "  sudo systemctl start rclone-gdrive.service"
echo "  sudo systemctl start home-video.service"
