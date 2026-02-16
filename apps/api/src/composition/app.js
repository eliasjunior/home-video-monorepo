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

export function createApp({ appConfig, env = process.env } = {}) {
  const app = express();
  const corsOptions = createCorsOptions({ appConfig, env });

  app.use(cors(corsOptions));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use("/public", express.static(path.resolve(__dirname, "../../public")));

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

  app.use("/auth", createAuthRouter({ refreshTokenStore, tokenService }));

  app.use((req, _res, next) => {
    if (req.path.startsWith("/public/")) return next();
    return requireAuth(req, _res, next);
  });

  app.use(
    "/",
    createVideosRouter({
      dataAccess: fileService,
      streamingData: streamService,
      appConfig,
    })
  );
  app.use("/", ImagesRouter);
  app.use(
    "/",
    createCaptionsRouter({
      appConfig,
      fileService,
      streamService,
    })
  );
  app.use("/", createProgressRouter());

  return app;
}
