import * as defaultTokenService from "../auth/tokenService";
import { getCookie } from "../common/Util";

const COOKIE_ACCESS = "access_token";

export function createRequireAuth({
  tokenService = defaultTokenService,
} = {}) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    const cookieToken = getCookie(req, COOKIE_ACCESS);

    const accessToken = type === "Bearer" && token ? token : cookieToken;

    if (!accessToken) {
      return res.status(401).json({ message: "Missing access token" }).end();
    }

    try {
      const payload = tokenService.verifyAccessToken(accessToken);
      req.user = { id: payload.sub, username: payload.username };
      return next();
    } catch {
      return res.status(401).json({ message: "Invalid access token" }).end();
    }
  };
}

export const requireAuth = createRequireAuth();
