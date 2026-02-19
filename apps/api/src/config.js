const dotenv = require("dotenv");
const os = require("os");

import { logD } from "./common/MessageUtil";

if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: ".env.development" });
} else if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
} else if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  logD(`there is no set process.env.NODE_ENV=${process.env.NODE_ENV}`);
}

export default function config() {
  const {
    SERVER_HOST,
    SERVER_PORT,
    IMG_FOLDER_FALL_BACK,
    VIDEO_PATH,
    VIDEO_PATH_LOCAL,
    VIDEO_PATH_GDRIVE,
    VIDEO_SOURCE_PROFILE,
    SERVER_PROTOCOL,
    MOVIES_DIR,
    SERIES_DIR,
    IMAGES_PORT_SERVER,
    IMAGE_MAP,
    IMAGE_MAP_ENABLED,
    IMAGE_FALLBACK_BASE_URL,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    COOKIE_DOMAIN,
    CORS_ORIGIN,
    PUBLIC_URL
  } = process.env;

  const result = {};

  logD("ENV ", process.env.NODE_ENV);

  result.protocol = SERVER_PROTOCOL;
  result.port = SERVER_PORT;
  const explicitHost = (SERVER_HOST || "").trim();
  result.host =
    process.env.NODE_ENV === "production" && explicitHost
      ? explicitHost
      : getLocalIPAddress();
  // in case you want read the images/posters from the another folder.
  result.imgFolderFallBack = IMG_FOLDER_FALL_BACK;
  const normalizedProfile = String(VIDEO_SOURCE_PROFILE || "local")
    .trim()
    .toLowerCase();
  const localVideoPath = VIDEO_PATH_LOCAL || VIDEO_PATH;
  const profileToPath = {
    local: localVideoPath,
    gdrive: VIDEO_PATH_GDRIVE,
  };
  const selectedVideoPath = profileToPath[normalizedProfile];
  result.videoSourceProfile = normalizedProfile;
  result.videosPath = selectedVideoPath || localVideoPath;
  if (!selectedVideoPath) {
    logD(
      `VIDEO_SOURCE_PROFILE=${normalizedProfile} has no path configured. Falling back to local path.`
    );
  }
  result.moviesDir = MOVIES_DIR;
  result.seriesDir = SERIES_DIR;
  result.baseLocation = os.homedir();
  result.serverUrl = `${result.protocol}://${result.host}:${result.port}`;
  result.publicUrl = PUBLIC_URL || '/';
  const fallbackBaseCandidate =
    IMAGE_FALLBACK_BASE_URL || `${result.serverUrl}/public`;
  result.imageFallbackBaseUrl = normalizeFallbackBaseUrl(fallbackBaseCandidate);
  //NGINX and it's not the images url in the AppServerConstant that has /images
  result.imageServerHost = result.host;
  result.imagePort = IMAGES_PORT_SERVER;
  result.imageMapFileName = IMAGE_MAP;
  result.imageMapEnabled = IMAGE_MAP_ENABLED;
  const cookieSecureRaw = String(COOKIE_SECURE || "").toLowerCase();
  if (cookieSecureRaw === "true" || cookieSecureRaw === "false") {
    result.cookieSecure = cookieSecureRaw === "true";
  } else {
    result.cookieSecure = process.env.NODE_ENV === "production";
  }
  const sameSite = String(COOKIE_SAMESITE || "lax").toLowerCase();
  result.cookieSameSite =
    sameSite === "lax" || sameSite === "strict" || sameSite === "none"
      ? sameSite
      : "lax";
  result.cookieDomain = COOKIE_DOMAIN || undefined;
  result.corsOrigin = CORS_ORIGIN || "";

  logD("config result", result);
  return result;
}

function normalizeFallbackBaseUrl(value) {
  const normalized = String(value || "").trim().replace(/\/$/, "");
  if (!normalized) {
    return normalized;
  }
  if (normalized.includes("movie_fallback.png")) {
    const corrected = normalized.replace(/\/movie_fallback\.png$/i, "");
    console.warn(
      "IMAGE_FALLBACK_BASE_URL should not include movie_fallback.png. " +
        `Using corrected base URL: ${corrected || normalized}`
    );
    return corrected || normalized;
  }
  return normalized;
}

function getLocalIPAddress() {
  const os = require("os");

  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Look for the IPv4, non-internal address
      if (iface.family === "IPv4" && !iface.internal) {
        console.log("Local Host IP:", iface.address);
        return iface.address;
      }
    }
  }
  return "127.0.0.1"; // Fallback to localhost
}
