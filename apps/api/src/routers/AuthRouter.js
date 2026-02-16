import express from "express";
import { AUTH_USER, validateCredentials } from "../auth/user";
import * as defaultTokenService from "../auth/tokenService";
import config from "../config";
import crypto from "crypto";
import { getCookie } from "../common/Util";

const COOKIE_ACCESS = "access_token";
const COOKIE_REFRESH = "refresh_token";
const COOKIE_CSRF = "csrf_token";

function buildCookieOptions({ isHttpOnly, maxAgeMs, path = "/", cfg }) {
  const options = {
    httpOnly: Boolean(isHttpOnly),
    secure: Boolean(cfg.cookieSecure),
    sameSite: cfg.cookieSameSite,
    path,
  };
  if (cfg.cookieDomain) {
    options.domain = cfg.cookieDomain;
  }
  if (Number.isFinite(maxAgeMs)) {
    options.maxAge = maxAgeMs;
  }
  return options;
}

function ensureCsrf(req, res) {
  const csrfHeader = req.headers["x-csrf-token"];
  const csrfCookie = getCookie(req, COOKIE_CSRF);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    res.status(403).json({ message: "Invalid CSRF token" }).end();
    return false;
  }
  return true;
}

export function createAuthRouter({
  refreshTokenStore,
  tokenService = defaultTokenService,
}) {
  const router = express.Router();
  const cfg = config();

  router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    const isValid = await validateCredentials({ username, password });
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" }).end();
    }

    const { accessToken, refreshToken, jti, refreshExpiresAtMs } =
      tokenService.issueTokens({
        userId: AUTH_USER.id,
        username: AUTH_USER.username,
      });

    refreshTokenStore.save({
      jti,
      userId: AUTH_USER.id,
      expiresAtMs: refreshExpiresAtMs,
    });

    const csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie(
      COOKIE_ACCESS,
      accessToken,
      buildCookieOptions({ isHttpOnly: true, cfg })
    );
    res.cookie(
      COOKIE_REFRESH,
      refreshToken,
      buildCookieOptions({ isHttpOnly: true, path: "/auth", cfg })
    );
    res.cookie(
      COOKIE_CSRF,
      csrfToken,
      buildCookieOptions({ isHttpOnly: false, cfg })
    );

    return res.status(200).json({ accessToken }).end();
  });

  router.post("/refresh", (req, res) => {
    const { refreshToken: refreshTokenBody } = req.body || {};
    const refreshToken =
      refreshTokenBody || getCookie(req, COOKIE_REFRESH);
    if (!refreshToken) {
      return res.status(400).json({ message: "Missing refresh token" }).end();
    }

    if (!refreshTokenBody && !ensureCsrf(req, res)) {
      return;
    }

    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      if (payload.type !== "refresh") {
        return res.status(401).json({ message: "Invalid refresh token" }).end();
      }

      const record = refreshTokenStore.get(payload.jti);
      if (!record || record.userId !== payload.sub) {
        return res.status(401).json({ message: "Refresh token revoked" }).end();
      }
      if (record.expiresAtMs < Date.now()) {
        refreshTokenStore.delete(payload.jti);
        return res.status(401).json({ message: "Refresh token expired" }).end();
      }

      refreshTokenStore.delete(payload.jti);
      const { accessToken, refreshToken: newRefreshToken, jti, refreshExpiresAtMs } =
        tokenService.issueTokens({
          userId: payload.sub,
          username: AUTH_USER.username,
        });
      refreshTokenStore.save({
        jti,
        userId: payload.sub,
        expiresAtMs: refreshExpiresAtMs,
      });

      const csrfToken = crypto.randomBytes(32).toString("hex");
      res.cookie(
        COOKIE_ACCESS,
        accessToken,
        buildCookieOptions({ isHttpOnly: true, cfg })
      );
      res.cookie(
        COOKIE_REFRESH,
        newRefreshToken,
        buildCookieOptions({ isHttpOnly: true, path: "/auth", cfg })
      );
      res.cookie(
        COOKIE_CSRF,
        csrfToken,
        buildCookieOptions({ isHttpOnly: false, cfg })
      );

      return res.status(200).json({ accessToken }).end();
    } catch {
      return res.status(401).json({ message: "Invalid refresh token" }).end();
    }
  });

  router.post("/logout", (req, res) => {
    const { refreshToken: refreshTokenBody } = req.body || {};
    const refreshToken =
      refreshTokenBody || getCookie(req, COOKIE_REFRESH);
    if (!refreshToken) {
      return res.status(400).json({ message: "Missing refresh token" }).end();
    }

    if (!refreshTokenBody && !ensureCsrf(req, res)) {
      return;
    }

    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      refreshTokenStore.delete(payload.jti);
    } catch {
      // swallow invalid token on logout
    }

    res.clearCookie(COOKIE_ACCESS, buildCookieOptions({ isHttpOnly: true, cfg }));
    res.clearCookie(
      COOKIE_REFRESH,
      buildCookieOptions({ isHttpOnly: true, path: "/auth", cfg })
    );
    res.clearCookie(COOKIE_CSRF, buildCookieOptions({ isHttpOnly: false, cfg }));
    return res.status(200).json({ message: "Logged out" }).end();
  });

  return router;
}
