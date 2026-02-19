import jwksClient from "jwks-rsa";
import jwt from "jsonwebtoken";

export function createJwksTokenProvider({ jwksUrl } = {}) {
  if (!jwksUrl) {
    throw new Error("JWKS_URL is required when JWKS_VALIDATION is enabled");
  }

  const client = jwksClient({
    jwksUri: jwksUrl,
    cache: true,
    cacheMaxAge: 600000, // 10 minutes
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });

  function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        return callback(err);
      }
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  return {
    sign(payload, options) {
      // JWKS provider doesn't sign tokens, only verifies them
      throw new Error("JWKS provider cannot sign tokens. Use JWT provider for token issuance.");
    },
    verify(token, options) {
      return new Promise((resolve, reject) => {
        jwt.verify(token, getKey, {}, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        });
      });
    },
  };
}

export default createJwksTokenProvider;
