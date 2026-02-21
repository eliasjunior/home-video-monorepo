import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { createVideosRouter } from "../routers/VideosRouter";
import ImagesRouter from "../routers/ImagesRouter";
import { createCaptionsRouter } from "../routers/CaptionsRouter";
import { createAuthRouter } from "../routers/AuthRouter";
import { createInMemoryRefreshTokenStore } from "../auth/refreshTokenStore";
import { createRequireAuth } from "../middleware/auth";
import { createTokenService } from "../auth/tokenService";
import { createProgressRouter } from "../routers/ProgressRouter";
import { createMediaServices } from "./mediaServices";
import { createCorsOptions } from "./corsOptions";

export function createApp({ appConfig, env = process.env, sessionMiddleware = null } = {}) {
  const app = express();
  const corsOptions = createCorsOptions({ appConfig, env });
  const publicUrl = (appConfig.publicUrl || '').replace(/\/$/, ''); // Remove trailing slash

  app.use(cors(corsOptions));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Session middleware (for Redis/Spring Session SSO) - passed from startup
  if (sessionMiddleware) {
    app.use(sessionMiddleware);
  }

  // Serve public static files
  const publicPath = path.resolve(__dirname, "../../public");
  if (publicUrl) {
    app.use(`${publicUrl}/public`, express.static(publicPath));
  }
  // Always serve at /public for backwards compatibility
  app.use("/public", express.static(publicPath));

  // Serve web app static files at PUBLIC_URL path
  // In Docker: /app/web/build
  const webBuildPath = path.resolve(__dirname, "../../web/build");
  if (publicUrl) {
    // Serve web build at publicUrl
    app.use(publicUrl, express.static(webBuildPath));
    // Also serve at root for files built without PUBLIC_URL (temporary workaround)
    app.use(express.static(webBuildPath, { redirect: false }));
  } else {
    app.use(express.static(webBuildPath));
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" }).end();
  });
  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  const refreshTokenStore = createInMemoryRefreshTokenStore();
  const tokenService = createTokenService();
  const { fileService, streamService } = createMediaServices();
  const requireAuth = createRequireAuth({ tokenService });

  // Mount auth routes (no auth required except for /me)
  app.use(
    `${publicUrl}/auth`,
    createAuthRouter({
      refreshTokenStore,
      services: { tokenService },
      requireAuth,
    })
  );

  // Auth middleware for protected routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/public/")) return next();
    if (req.path.startsWith(`${publicUrl}/auth`)) return next();
    if (req.path.startsWith("/health")) return next();
    if (req.path.startsWith("/favicon.ico")) return next();

    // Skip auth for WebSocket upgrade requests
    const wsPath = publicUrl ? `${publicUrl}/ws` : '/ws';
    if (req.path === wsPath || req.path.startsWith(`${wsPath}/`)) {
      console.log(`[AUTH] Skipping auth for WebSocket path: ${req.path}`);
      return next();
    }

    // Check if this is an API route that needs authentication
    const pathWithoutPublicUrl = publicUrl ? req.path.replace(publicUrl, '') : req.path;
    const isApiRoute = pathWithoutPublicUrl.match(/^\/(videos|images|captions|progress|series)/);

    if (isApiRoute) {
      // Disable caching for authenticated API routes to ensure auth is always checked
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return requireAuth(req, res, next);
    }

    // Skip auth for static files
    return next();
  });

  // Mount API routes (with auth)
  app.use(
    publicUrl || "/",
    createVideosRouter({
      dataAccess: fileService,
      streamingData: streamService,
      appConfig,
    })
  );
  app.use(publicUrl || "/", ImagesRouter);
  app.use(
    publicUrl || "/",
    createCaptionsRouter({
      appConfig,
      fileService,
      streamService,
    })
  );
  app.use(publicUrl || "/", createProgressRouter());

  // Serve index.html for all other routes (SPA fallback)
  app.use((req, res) => {
    // Serve index.html for any unmatched routes under publicUrl
    if (publicUrl && req.path.startsWith(publicUrl)) {
      res.sendFile(path.resolve(webBuildPath, "index.html"));
    } else if (!publicUrl) {
      res.sendFile(path.resolve(webBuildPath, "index.html"));
    } else {
      res.status(404).send("Not Found");
    }
  });

  return app;
}
