import jwt from "jsonwebtoken";
import crypto from "crypto";

const accessSecret = process.env.JWT_ACCESS_SECRET || "access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "refresh-secret";
const accessTtl = process.env.JWT_ACCESS_TTL || "15m";
const refreshTtl = process.env.JWT_REFRESH_TTL || "180d";

export function parseDurationToMs(value) {
  if (typeof value === "number") {
    return value;
  }
  const match = String(value).match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 0;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

export function issueTokens({ userId, username }) {
  // Access token: short-lived token used on every request (Authorization: Bearer ...)
  const accessToken = jwt.sign(
    { sub: userId, username },
    accessSecret,
    { expiresIn: accessTtl }
  );

  // "jti" is a unique ID for the refresh token so we can revoke/rotate it.
  const jti = crypto.randomUUID();
  // Refresh token: long-lived token used to get a new access token.
  const refreshToken = jwt.sign(
    { sub: userId, jti, type: "refresh" },
    refreshSecret,
    { expiresIn: refreshTtl }
  );

  // Store refresh token expiry timestamp so the store can enforce max age.
  const refreshExpiresAtMs = Date.now() + parseDurationToMs(refreshTtl);

  return { accessToken, refreshToken, jti, refreshExpiresAtMs };
}

export function verifyAccessToken(token) {
  // Verifies signature and expiration for access token.
  return jwt.verify(token, accessSecret);
}

export function verifyRefreshToken(token) {
  // Verifies signature and expiration for refresh token.
  return jwt.verify(token, refreshSecret);
}
