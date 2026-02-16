import jwt from "jsonwebtoken";
import crypto from "crypto";
import jwksClient from "jwks-rsa";

const accessSecret = process.env.JWT_ACCESS_SECRET || "access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "refresh-secret";
const accessTtl = process.env.JWT_ACCESS_TTL || "15m";
const refreshTtl = process.env.JWT_REFRESH_TTL || "180d";
const jwksValidation = process.env.JWKS_VALIDATION === "true";
let jwksUrl = process.env.JWKS_URL;

// Replace localhost with actual IP address
if (jwksUrl && jwksUrl.includes("localhost")) {
  const os = require("os");
  const networkInterfaces = os.networkInterfaces();
  let localIP = "127.0.0.1";

  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  jwksUrl = jwksUrl.replace("localhost", localIP);
  console.log(`JWKS_URL resolved: ${jwksUrl}`);
}

// Cache for JWKS keys (to avoid fetching on every request)
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

// JWKS client for validating tokens with remote public keys
let client = null;
if (jwksValidation && jwksUrl) {
  client = jwksClient({
    jwksUri: jwksUrl,
    cache: true,
    cacheMaxAge: JWKS_CACHE_TTL,
  });
}

// Fetch JWKS keys directly (to support symmetric keys)
async function fetchJwksKeys() {
  if (jwksCache && (Date.now() - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  console.log(`[JWKS] Fetching keys from ${jwksUrl}`);
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  const jwks = await response.json();
  jwksCache = jwks.keys || [];
  jwksCacheTime = Date.now();
  console.log(`[JWKS] Fetched ${jwksCache.length} keys`);
  return jwksCache;
}

// Helper to get signing key from JWKS (supports both symmetric and asymmetric keys)
async function getKey(header) {
  if (!jwksUrl) {
    throw new Error("JWKS URL not configured");
  }

  const keys = await fetchJwksKeys();
  const key = keys.find(k => k.kid === header.kid);

  if (!key) {
    throw new Error(`Key with kid "${header.kid}" not found in JWKS`);
  }

  console.log(`[JWKS] Found key with kid: ${header.kid}, type: ${key.kty}, alg: ${key.alg}`);

  // Handle symmetric keys (HMAC - HS256, HS384, HS512)
  if (key.kty === "oct") {
    // Symmetric key - decode from base64
    const secret = Buffer.from(key.k, "base64").toString("utf8");
    console.log(`[JWKS] Using symmetric key (${key.alg})`);
    return secret;
  }

  // Handle asymmetric keys (RSA, EC)
  // Use jwks-rsa library for proper RSA/EC key handling
  return new Promise((resolve, reject) => {
    client.getSigningKey(header.kid, (err, jwksKey) => {
      if (err) {
        reject(err);
      } else {
        const signingKey = jwksKey.publicKey || jwksKey.rsaPublicKey;
        console.log(`[JWKS] Using asymmetric key (${key.alg})`);
        resolve(signingKey);
      }
    });
  });
}

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

export async function verifyAccessToken(token) {
  // Verifies signature and expiration for access token.

  console.log('Token verification - JWKS enabled:', jwksValidation, 'Client configured:', !!client);

  // Always try local secret validation first for internally issued tokens
  try {
    console.log('Attempting local secret validation');
    const result = jwt.verify(token, accessSecret);
    console.log('Local secret validation succeeded');
    return result;
  } catch (localError) {
    console.log('Local secret validation failed:', localError.message);
    // If local validation fails and JWKS is enabled, try JWKS validation
    if (jwksValidation && client) {
      console.log('Attempting JWKS validation');
      return new Promise((resolve, reject) => {
        jwt.verify(
          token,
          async (header, callback) => {
            try {
              const key = await getKey(header);
              callback(null, key);
            } catch (err) {
              console.log('JWKS key fetch failed:', err.message);
              callback(err);
            }
          },
          (err, decoded) => {
            if (err) {
              console.log('JWKS validation failed:', err.message);
              reject(err);
            } else {
              console.log('JWKS validation succeeded');
              resolve(decoded);
            }
          }
        );
      });
    }
    // If no JWKS or JWKS not enabled, throw the local error
    throw localError;
  }
}

export function verifyRefreshToken(token) {
  // Verifies signature and expiration for refresh token.
  return jwt.verify(token, refreshSecret);
}
