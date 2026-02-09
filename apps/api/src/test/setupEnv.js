const dotenv = require("dotenv");

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

process.env.DOTENV_CONFIG_QUIET = "true";
dotenv.config({ path: ".env.test" });

// Ensure JWT secrets exist for tests.
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-refresh-secret";
process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || "15m";
process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || "180d";
