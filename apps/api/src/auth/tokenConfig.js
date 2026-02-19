export function createTokenConfig(env = process.env) {
  return {
    accessSecret: env.JWT_ACCESS_SECRET || "access-secret",
    refreshSecret: env.JWT_REFRESH_SECRET || "refresh-secret",
    accessTtl: env.JWT_ACCESS_TTL || "15m",
    refreshTtl: env.JWT_REFRESH_TTL || "180d",
    jwksValidation: env.JWKS_VALIDATION === "true",
    jwksUrl: env.JWKS_URL || "",
  };
}

