#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-password}"

echo "==> Login"
LOGIN_RESPONSE="$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")"
echo "$LOGIN_RESPONSE"

ACCESS_TOKEN="$(echo "$LOGIN_RESPONSE" | node -pe "JSON.parse(fs.readFileSync(0,'utf8')).accessToken")"
REFRESH_TOKEN="$(echo "$LOGIN_RESPONSE" | node -pe "JSON.parse(fs.readFileSync(0,'utf8')).refreshToken")"

echo
echo "==> Access protected endpoint"
curl -s "$API_URL/videos" -H "Authorization: Bearer $ACCESS_TOKEN"
echo

echo
echo "==> Refresh tokens"
REFRESH_RESPONSE="$(curl -s -X POST "$API_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")"
echo "$REFRESH_RESPONSE"

echo
echo "==> Logout"
curl -s -X POST "$API_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
echo
