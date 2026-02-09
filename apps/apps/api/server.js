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

let app = express();

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
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" }).end();
});
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

const refreshTokenStore = createInMemoryRefreshTokenStore();
app.use("/auth", createAuthRouter({ refreshTokenStore }));

app.use((req, _res, next) => {
  if (req.path.startsWith("/public/")) return next();
  return requireAuth(req, _res, next);
});
app.use("/", VideosRouter);
app.use("/", ImagesRouter);
app.use("/", CaptionsRouter);
app.use("/", createProgressRouter());

if (process.env.NODE_ENV !== "test") {
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
