export function createCorsOptions({ appConfig, env = process.env } = {}) {
  const corsOrigins = (appConfig.corsOrigin || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDev = env.NODE_ENV === "development";

  const allowedDevOrigin = (origin) => {
    if (!origin) return true;
    if (origin === "http://localhost:3000") return true;
    return /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):3000$/.test(
      origin
    );
  };

  return {
    origin: (origin, callback) => {
      if (isDev && allowedDevOrigin(origin)) {
        return callback(null, true);
      }
      if (!origin) {
        return callback(null, true);
      }
      if (corsOrigins.length === 0) {
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  };
}

