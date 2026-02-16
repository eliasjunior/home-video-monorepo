import express from "express";
import { AUTH_USER, validateCredentials } from "../auth/user";
import {
  issueTokens,
  verifyRefreshToken,
} from "../auth/tokenService";
import config from "../config";
import crypto from "crypto";
import { getCookie } from "../common/Util";
import { ssoRedisEnabled, sessionCookieName } from "../auth/redisSessionStore";

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

export function createAuthRouter({ refreshTokenStore }) {
  const router = express.Router();
  const cfg = config();

  // Check if user is authenticated (for redirecting from login page)
  router.get("/check", (req, res) => {
    console.log(`[AUTH_CHECK] Cookies:`, req.headers.cookie);
    console.log(`[AUTH_CHECK] SessionID: ${req.sessionID}`);
    console.log(`[AUTH_CHECK] Session exists: ${!!req.session}`);
    console.log(`[AUTH_CHECK] Session data:`, JSON.stringify(req.session, null, 2));
    console.log(`[AUTH_CHECK] Session authenticated: ${req.session?.authenticated}`);
    console.log(`[AUTH_CHECK] Session user: ${req.session?.user?.username}`);

    if (req.session && req.session.authenticated && req.session.user) {
      return res.status(200).json({
        authenticated: true,
        user: {
          id: req.session.user.id,
          username: req.session.user.username,
          email: req.session.user.email,
        },
      }).end();
    }
    return res.status(200).json({ authenticated: false }).end();
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    const isValid = await validateCredentials({ username, password });

    // If local validation fails, try second retry if enabled
    if (!isValid) {
      const secondRetryEnabled = process.env.LOGIN_SECOND_RETRY === "true";
      const secondRetryUrl = process.env.LOGIN_SECOND_RETRY_URL;

      if (secondRetryEnabled && secondRetryUrl) {
        console.log(`[LOGIN] Local validation failed, attempting second retry at: ${secondRetryUrl}`);

        try {
          // Call external authentication service
          const response = await fetch(secondRetryUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          });

          if (response.ok) {
            // Get token from response header (Authorization or custom header)
            const authHeader = response.headers.get("Authorization");
            let externalToken = null;

            if (authHeader) {
              // Extract token from "Bearer <token>" format
              const [type, token] = authHeader.split(" ");
              if (type === "Bearer" && token) {
                externalToken = token;
              }
            }

            // Also check custom header in case token is there
            if (!externalToken) {
              externalToken = response.headers.get("X-Auth-Token");
            }

            if (externalToken) {
              console.log(`[LOGIN] Second retry successful, received external token`);

              // Issue our own tokens for session consistency
              const { accessToken, refreshToken, jti, refreshExpiresAtMs } = issueTokens({
                userId: username, // Use username as ID
                username: username,
              });

              refreshTokenStore.save({
                jti,
                userId: username,
                expiresAtMs: refreshExpiresAtMs,
              });

              // Store authentication context in session
              req.session.authenticated = true;
              req.session.user = {
                id: username,
                username: username,
                email: username,
                authorities: ["ROLE_USER"],
                accountNonLocked: true,
                accountNonExpired: true,
                credentialsNonExpired: true,
                enabled: true,
              };
              req.session.token = {
                tokenType: "Bearer",
                tokenValue: accessToken,
                issuedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                scopes: ["ROLE_USER"],
              };
              req.session.externalToken = externalToken; // Store external token if needed
              req.session.lastAccessedTime = Date.now();

              console.log(`[LOGIN] Session saved for external user: ${username}, sessionID: ${req.sessionID}`);

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
            } else {
              console.log(`[LOGIN] Second retry response missing token in headers`);
            }
          } else {
            console.log(`[LOGIN] Second retry failed with status: ${response.status}`);
          }
        } catch (error) {
          console.error(`[LOGIN] Second retry error:`, error.message);
        }
      }

      // If we reach here, both validations failed
      return res.status(401).json({ message: "Invalid credentials" }).end();
    }

    const { accessToken, refreshToken, jti, refreshExpiresAtMs } = issueTokens({
      userId: AUTH_USER.id,
      username: AUTH_USER.username,
    });

    refreshTokenStore.save({
      jti,
      userId: AUTH_USER.id,
      expiresAtMs: refreshExpiresAtMs,
    });

    // Store authentication context in session (similar to Spring Security)
    req.session.authenticated = true;
    req.session.user = {
      id: AUTH_USER.id,
      username: AUTH_USER.username,
      email: AUTH_USER.username,
      authorities: ["ROLE_ADMIN"],
      accountNonLocked: true,
      accountNonExpired: true,
      credentialsNonExpired: true,
      enabled: true,
    };
    req.session.token = {
      tokenType: "Bearer",
      tokenValue: accessToken,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
      scopes: ["ROLE_ADMIN"],
    };
    req.session.lastAccessedTime = Date.now();

    console.log(`[LOGIN] Session saved for user: ${AUTH_USER.username}, sessionID: ${req.sessionID}`);

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
      const payload = verifyRefreshToken(refreshToken);
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
        issueTokens({
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
    console.log("[LOGOUT] Processing logout request");
    console.log("[LOGOUT] Cookies:", req.headers.cookie);
    console.log("[LOGOUT] SessionID:", req.sessionID);

    const { refreshToken: refreshTokenBody } = req.body || {};
    const refreshToken =
      refreshTokenBody || getCookie(req, COOKIE_REFRESH);

    // Don't require refresh token for Spring Session logout
    if (!refreshToken && !req.session?.authenticated) {
      console.log("[LOGOUT] No refresh token and no active session");
      return res.status(400).json({ message: "Not logged in" }).end();
    }

    if (refreshToken && !refreshTokenBody && !ensureCsrf(req, res)) {
      return;
    }

    // Delete refresh token if present
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        refreshTokenStore.delete(payload.jti);
        console.log("[LOGOUT] Deleted refresh token");
      } catch {
        // swallow invalid token on logout
      }
    }

    // Destroy session in Redis if it exists
    if (req.session && req.sessionID) {
      console.log("[LOGOUT] Destroying session:", req.sessionID);
      req.session.destroy((err) => {
        if (err) {
          console.error("[LOGOUT] Session destroy error:", err);
        } else {
          console.log("[LOGOUT] Session destroyed successfully");
        }
      });
    }

    // Clear all authentication cookies
    res.clearCookie(COOKIE_ACCESS, buildCookieOptions({ isHttpOnly: true, cfg }));
    res.clearCookie(
      COOKIE_REFRESH,
      buildCookieOptions({ isHttpOnly: true, path: "/auth", cfg })
    );
    res.clearCookie(COOKIE_CSRF, buildCookieOptions({ isHttpOnly: false, cfg }));

    // Clear session cookies (both SESSIONID and SESSION)
    if (ssoRedisEnabled) {
      // Clear SESSIONID (Spring Session default)
      res.clearCookie("SESSIONID", {
        path: "/",
        httpOnly: true,
        secure: cfg.cookieSecure,
        sameSite: cfg.cookieSameSite,
      });
      console.log("[LOGOUT] Cleared SESSIONID cookie");

      // Clear SESSION if it's different
      if (sessionCookieName !== "SESSIONID") {
        res.clearCookie(sessionCookieName, {
          path: "/",
          httpOnly: true,
          secure: cfg.cookieSecure,
          sameSite: cfg.cookieSameSite,
        });
        console.log(`[LOGOUT] Cleared ${sessionCookieName} cookie`);
      }
    }

    console.log("[LOGOUT] Logout completed successfully");
    return res.status(200).json({ message: "Logged out" }).end();
  });

  return router;
}
