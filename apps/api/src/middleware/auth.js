import * as defaultTokenService from "../auth/tokenService";
import { getCookie } from "../common/Util";
import { getUser } from "../user/userStore.js";

const COOKIE_ACCESS = "access_token";

export function createRequireAuth({
  tokenService = defaultTokenService,
} = {}) {
  return async function requireAuth(req, res, next) {
    console.log(`[AUTH] ${req.method} ${req.path} - Checking authentication`);

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
      // verifyAccessToken may return a Promise when using JWKS
      const payload = await tokenService.verifyAccessToken(accessToken);
      req.user = { id: payload.sub, username: payload.username };

      // Ensure user data from store is attached (for videoPath)
      const storedUser = getUser(req.user.username);
      if (storedUser) {
        req.user.videoPath = storedUser.videoPath;
      }

      console.log(`[AUTH] Authenticated via JWT: ${req.user.username}`);
      return next();
    } catch(error) {
      console.log(`[AUTH] Invalid access token: ${error.message}`);
      return res.status(401).json({ message: "Invalid access token" }).end();
    }
  };
}

export const requireAuth = createRequireAuth();
