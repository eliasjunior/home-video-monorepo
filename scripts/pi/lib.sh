#!/usr/bin/env bash
# Purpose: shared helper functions used by Pi provisioning scripts
# (retry logic, preflight checks, IPv4 validation, env upsert).

# Shared helpers for Raspberry Pi provisioning scripts.

retry() {
  local attempts="$1"
  local delay="$2"
  shift 2

  # Bounded retry helper to avoid infinite loops on transient failures.
  local n=1
  while true; do
    if "$@"; then
      return 0
    fi

    if [[ "$n" -ge "$attempts" ]]; then
      echo "Command failed after ${attempts} attempts: $*"
      return 1
    fi

    echo "Attempt ${n}/${attempts} failed. Retrying in ${delay}s: $*"
    sleep "$delay"
    n=$((n + 1))
  done
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    return 1
  fi
}

is_ipv4() {
  local ip="$1"
  local re='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
  if [[ ! "$ip" =~ $re ]]; then
    return 1
  fi

  # Validate each octet stays in 0-255.
  local old_ifs="$IFS"
  IFS='.'
  local -a octets=($ip)
  IFS="$old_ifs"

  for octet in "${octets[@]}"; do
    if ((octet < 0 || octet > 255)); then
      return 1
    fi
  done
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  # Update existing KEY=... line, or append when key is missing.
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}
