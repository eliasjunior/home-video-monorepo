import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import VideosRouter from "./src/routers/VideosRouter";
import ImagesRouter from "./src/routers/ImagesRouter";
import CaptionsRouter from "./src/routers/CaptionsRouter";
import { config } from "./src/common/AppServerConstant";
import { logD } from "./src/common/MessageUtil";
import { loadRemoteJsonFile } from "./src/libs/HttpLib";
import path from "path";
import { setMoviesMap } from "./src/libs/MemoryLib";
import { createAuthRouter } from "./src/routers/AuthRouter";
import { createInMemoryRefreshTokenStore } from "./src/auth/refreshTokenStore";
import { requireAuth } from "./src/middleware/auth";
import { createProgressRouter } from "./src/routers/ProgressRouter";
import { createSessionMiddleware, ssoRedisEnabled } from "./src/auth/redisSessionStore";

let app = express();

// Session middleware placeholder - will be initialized before server starts
let sessionInitialized = false;
let sessionMiddleware = null;

// Middleware wrapper for session
app.use((req, res, next) => {
  if (sessionMiddleware) {
    return sessionMiddleware(req, res, next);
  }
  next();
});

const corsOrigins = (config.corsOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV === "development";
const allowedDevOrigin = (origin) => {
  if (!origin) return true;
  if (origin === "http://localhost:3000") return true;
  return /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):3000$/.test(
    origin
  );
};
const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header)
    if (!origin) {
      return callback(null, true);
    }
    // Allow development origins
    if (isDev && allowedDevOrigin(origin)) {
      return callback(null, true);
    }
    // If no CORS origins configured, allow all
    if (corsOrigins.length === 0) {
      return callback(null, true);
    }
    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

// Serve React static files from web app build folder
const webBuildPath = path.join(__dirname, "web/build");
app.use(express.static(webBuildPath));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" }).end();
});
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// Serve React app home page for root
app.get("/", (_req, res) => {
  res.sendFile(path.join(webBuildPath, "index.html"));
});

const refreshTokenStore = createInMemoryRefreshTokenStore();
app.use("/auth", createAuthRouter({ refreshTokenStore }));

// Apply auth middleware only to API routes
app.use((req, _res, next) => {
  // Skip auth for public files and static assets
  if (req.path.startsWith("/public/")) return next();
  // Skip auth for static files (js, css, images, etc)
  if (/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(req.path)) return next();
  // Skip auth for root and health endpoints
  if (req.path === "/" || req.path === "/health" || req.path === "/favicon.ico") return next();
  // Apply auth to all API routes
  if (req.path.startsWith("/videos") ||
      req.path.startsWith("/series") ||
      req.path.startsWith("/images") ||
      req.path.startsWith("/captions") ||
      req.path.startsWith("/progress")) {
    return requireAuth(req, _res, next);
  }
  // Skip auth for everything else (React routes)
  return next();
});

app.use("/", VideosRouter);
app.use("/", ImagesRouter);
app.use("/", CaptionsRouter);
app.use("/", createProgressRouter());

// Serve React app for all other routes (SPA fallback)
app.use((_req, res) => {
  res.sendFile(path.join(webBuildPath, "index.html"));
});

async function initializeSession() {
  if (sessionInitialized) return;
  console.log("Initializing session middleware...");
  sessionMiddleware = await createSessionMiddleware();
  sessionInitialized = true;
  console.log("Session middleware initialized");
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      // Initialize session before starting server
      console.log("Starting server initialization...");
      await initializeSession();
      console.log("Session initialized, starting HTTP server...");

      app.listen(config.port, async () => {
        console.log(`Application started, ${config.serverUrl}`);
        console.log(`App config`);
        console.log(`Movies folder: ${config.moviesDir}`);
        console.log(`baseLocation: ${config.baseLocation}`);

        const imageMapEnabled =
          String(config.imageMapEnabled || "").toLowerCase() === "true";
        if (imageMapEnabled) {
          const jsonUrl = `${config.protocol}://${config.imageServerHost}:${config.imagePort}/json/${config.imageMapFileName}`;
          logD("jsonUrl=>", jsonUrl);
          const moviesMap = await fetchAndLogJsonData(jsonUrl);
          logD("moviesMap=", moviesMap);
          setMoviesMap(moviesMap || {});
        } else {
          logD("image map disabled via IMAGE_MAP_ENABLED");
          setMoviesMap({});
        }
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}

async function fetchAndLogJsonData(remoteJsonUrl) {
  try {
    return await loadRemoteJsonFile(remoteJsonUrl);
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `error to retrieve json map in ${remoteJsonUrl} \n ${error.message}`
      );
    } else {
      console.warn(
        `Image map unavailable at ${remoteJsonUrl}. Using empty map (dev).`
      );
    }
    return {};
  }
}

export default app;
