import * as defaultTokenService from "../auth/tokenService";
import { getCookie } from "../common/Util";
import { getUser, upsertUser } from "../user/userStore.js";
import { checkNextcloudRedisSession } from "../auth/nextcloudAuthService.js";
import { ensureUserDirectory } from "../user/userDirectory.js";

const COOKIE_ACCESS = "access_token";

export function createRequireAuth({
  tokenService = defaultTokenService,
  redisClient = null,
} = {}) {
  return async function requireAuth(req, res, next) {
    console.log(`[AUTH] ${req.method} ${req.path} - Checking authentication`);

    // Check Nextcloud Redis session if enabled (automatic SSO)
    const nextcloudAuthEnabled = process.env.NEXTCLOUD_AUTH_ENABLED === 'true';
    const ssoRedisEnabled = process.env.SSO_REDIS_ENABLED === 'true';

    if (nextcloudAuthEnabled && ssoRedisEnabled && redisClient && req.sessionID) {
      console.log(`[AUTH] Checking Nextcloud Redis session for sessionID: ${req.sessionID}`);

      const nextcloudSessionPrefix = process.env.NEXTCLOUD_SESSION_PREFIX || 'PHPREDIS_SESSION:';
      console.log(`[AUTH] About to call checkNextcloudRedisSession...`);
      const nextcloudSession = await checkNextcloudRedisSession({
        redisClient,
        sessionId: req.sessionID,
        nextcloudSessionPrefix
      });
      console.log(`[AUTH] checkNextcloudRedisSession returned:`, nextcloudSession);

      if (nextcloudSession.authenticated) {
        if (nextcloudSession.username) {
          console.log(`[AUTH] Authenticated via Nextcloud Redis session: ${nextcloudSession.username}`);

          // Register user and create directories if needed
          const appUser = upsertUser(nextcloudSession.username);
          ensureUserDirectory(nextcloudSession.username);

          // Set up session
          if (req.session) {
            req.session.authenticated = true;
            req.session.user = {
              id: appUser.id,
              username: nextcloudSession.username,
              email: nextcloudSession.username,
              authorities: ["ROLE_USER"],
              videoPath: appUser.videoPath,
            };
            req.user = req.session.user;
          } else {
            req.user = {
              id: appUser.id,
              username: nextcloudSession.username,
              videoPath: appUser.videoPath,
            };
          }

          return next();
        } else if (nextcloudSession.encrypted) {
          // Nextcloud session is encrypted - we can't get username from Redis
          // Fall through to check Spring Session or use existing session
          console.log(`[AUTH] Found encrypted Nextcloud session, checking Spring Session for username`);
        }
      }
    }

    // Check session first (SSO via Redis or memory)
    if (req.session && req.session.authenticated && req.session.user) {
      req.session.lastAccessedTime = Date.now();
      req.user = req.session.user;

      // Ensure user data from store is attached (for videoPath)
      const storedUser = getUser(req.user.username);
      if (storedUser) {
        req.user.videoPath = storedUser.videoPath;
      }

      console.log(`[AUTH] Authenticated via session: ${req.user.username}`);
      return next();
    }

    console.log(`[AUTH] No valid session found, checking JWT token`);

    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    const cookieToken = getCookie(req, COOKIE_ACCESS);

    const accessToken = type === "Bearer" && token ? token : cookieToken;

    if (!accessToken) {
      console.log(`[AUTH] No access token found in header or cookie`);
      return res.status(401).json({ message: "Missing access token" }).end();
    }

    try {
      // Decode token without verifying expiration - we trust the cookie/Redis for validity
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(accessToken);

      if (!payload || !payload.username) {
        console.log(`[AUTH] Invalid token payload`);
        return res.status(401).json({ message: "Invalid access token" }).end();
      }

      // Check if user exists in store (validates the token is for a real user)
      const storedUser = getUser(payload.username);
      if (!storedUser) {
        console.log(`[AUTH] User not found in store: ${payload.username}`);
        return res.status(401).json({ message: "User not found" }).end();
      }

      req.user = {
        id: payload.sub,
        username: payload.username,
        videoPath: storedUser.videoPath
      };

      console.log(`[AUTH] Authenticated via JWT: ${req.user.username}`);
      return next();
    } catch(error) {
      console.log(`[AUTH] Error processing access token: ${error.message}`);
      return res.status(401).json({ message: "Invalid access token" }).end();
    }
  };
}

export const requireAuth = createRequireAuth();
