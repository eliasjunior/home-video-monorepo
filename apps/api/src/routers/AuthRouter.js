import express from "express";
import { AUTH_USER, validateCredentials } from "../auth/user";
import * as defaultTokenService from "../auth/tokenService";
import { createAuthCookieService } from "../auth/authCookieService";
import { generateCsrfToken } from "../auth/csrfToken";
import { createAuthLoginService } from "../auth/authLoginService";
import { createAuthSessionService } from "../auth/authSessionService";
import config from "../config";
import { getCookie } from "../common/Util";
import { ensureCsrf } from "../middleware/csrf";
import { upsertUser } from "../user/userStore.js";
import { ensureUserDirectory } from "../user/userDirectory.js";

const COOKIE_ACCESS = "access_token";
const COOKIE_REFRESH = "refresh_token";
const COOKIE_CSRF = "csrf_token";

export function createAuthRouter({
  refreshTokenStore,
  services = {},
  requireAuth,
}) {
  const router = express.Router();
  const cfg = config();
  const tokenService = services.tokenService || defaultTokenService;
  const csrfTokenGenerator =
    services.csrfTokenGenerator || generateCsrfToken;
  const authLoginService =
    services.authLoginService ||
    createAuthLoginService({
      tokenService,
      refreshTokenStore,
      csrfTokenGenerator,
    });
  const authSessionService =
    services.authSessionService ||
    createAuthSessionService({
      tokenService,
      refreshTokenStore,
    });
  const cookies =
    services.authCookieService ||
    createAuthCookieService({
      cfg,
      cookieNames: {
        access: COOKIE_ACCESS,
        refresh: COOKIE_REFRESH,
        csrf: COOKIE_CSRF,
      },
    });

  router.post("/login", login);
  router.post("/refresh", refresh);
  router.post("/logout", logout);
  router.get("/me", requireAuth || ((req, res, next) => next()), me);
  router.get("/oauth2-config", getOAuth2Config);

  async function login(req, res) {
    const { username, password } = req.body || {};
    const isValid = await validateCredentials({ username, password });

    // If local validation fails, try second retry if enabled
    if (!isValid) {
      const secondRetryEnabled = process.env.LOGIN_SECOND_RETRY === "true";
      const secondRetryUrl = process.env.LOGIN_SECOND_RETRY_URL;

      if (secondRetryEnabled && secondRetryUrl) {
        console.log(`[LOGIN] Local validation failed, attempting second retry at: ${secondRetryUrl}`);

        try {
          // Get CSRF URL from config or construct from base URL
          const csrfUrl = process.env.LOGIN_SECOND_RETRY_CSRF_URL ||
            (() => {
              const baseUrl = secondRetryUrl.substring(0, secondRetryUrl.lastIndexOf('/api/'));
              return `${baseUrl}/api/csrf`;
            })();

          console.log(`[LOGIN] Fetching CSRF token from: ${csrfUrl}`);

          // Step 1: Get CSRF token
          const csrfResponse = await fetch(csrfUrl, {
            method: "GET",
            credentials: "include",
          });

          if (csrfResponse.ok) {
            const csrfData = await csrfResponse.json();
            const csrfToken = csrfData.token;
            const csrfHeaderName = csrfData.headerName || "X-CSRF-TOKEN";

            if (csrfToken) {
              console.log(`[LOGIN] CSRF token obtained: ${csrfToken.substring(0, 10)}...`);
              console.log(`[LOGIN] Using CSRF header: ${csrfHeaderName}`);

              // Step 2: Call external authentication service with CSRF token
              const headers = {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                'X-XSRF-TOKEN': csrfToken
              };
              const loginForm = "username=" + encodeURIComponent(username) + '&password=' + encodeURIComponent(password);

              const response = await fetch(secondRetryUrl, {
                method: "POST",
                headers,
                credentials: "include",
                body: loginForm,
              });

              if (response.ok) {
                // Register user in application store and create directories
                const appUser = upsertUser(username);
                ensureUserDirectory(username);

                // Create login session for external user
                const loginSession = authLoginService.createLoginSession({
                  userId: appUser.id,
                  username: username,
                });

                cookies.setAuthCookies({ res, session: loginSession });

                // Store authentication context in session if exists
                if (req.session) {
                  req.session.authenticated = true;
                  req.session.user = {
                    id: appUser.id,
                    username: username,
                    email: username,
                    authorities: ["ROLE_USER"],
                    videoPath: appUser.videoPath,
                  };
                }

                console.log(`[LOGIN] Second retry successful for user: ${username}`);
                return res.status(200).json({ accessToken: loginSession.accessToken }).end();
              }
            }
          }
        } catch (error) {
          console.error(`[LOGIN] Second retry error:`, error.message);
        }
      }

      return res.status(401).json({ message: "Invalid credentials" }).end();
    }

    // Register admin user in application store and create directories
    const appUser = upsertUser(AUTH_USER.username);
    ensureUserDirectory(AUTH_USER.username);

    const loginSession = authLoginService.createLoginSession({
      userId: AUTH_USER.id,
      username: AUTH_USER.username,
    });

    cookies.setAuthCookies({ res, session: loginSession });

    // Store authentication context in session if exists
    if (req.session) {
      req.session.authenticated = true;
      req.session.user = {
        id: AUTH_USER.id,
        username: AUTH_USER.username,
        email: AUTH_USER.username,
        authorities: ["ROLE_ADMIN"],
        videoPath: appUser.videoPath,
      };
    }

    return res.status(200).json({ accessToken: loginSession.accessToken }).end();
  }

  function refresh(req, res) {
    const { refreshToken: refreshTokenBody } = req.body || {};
    const refreshToken = refreshTokenBody || getCookie(req, COOKIE_REFRESH);
    if (!refreshToken) {
      return res.status(400).json({ message: "Missing refresh token" }).end();
    }

    if (
      !refreshTokenBody &&
      !ensureCsrf({ req, res, cookieName: COOKIE_CSRF })
    ) {
      return;
    }

    const refreshResult = authSessionService.rotateRefreshSession({
      refreshToken,
      username: AUTH_USER.username,
    });
    if (!refreshResult.ok) {
      return res
        .status(refreshResult.status)
        .json({ message: refreshResult.message })
        .end();
    }

    const session = {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken,
      csrfToken: csrfTokenGenerator(),
    };
    cookies.setAuthCookies({ res, session });

    return res
      .status(200)
      .json({ accessToken: refreshResult.accessToken })
      .end();
  }

  function logout(req, res) {
    console.log(`[LOGOUT] Logout request received`);
    console.log(`[LOGOUT] Has session: ${!!req.session}, sessionID: ${req.sessionID}`);
    console.log(`[LOGOUT] Session data:`, req.session ? { authenticated: req.session.authenticated, username: req.session.user?.username } : 'null');

    const { refreshToken: refreshTokenBody } = req.body || {};
    const refreshToken = refreshTokenBody || getCookie(req, COOKIE_REFRESH);
    const ssoRedisEnabled = process.env.SSO_REDIS_ENABLED === 'true';

    // When using SSO Redis session, refresh token is optional (user authenticated via external SSO)
    if (!refreshToken && !ssoRedisEnabled) {
      console.log('[LOGOUT] Missing refresh token and SSO not enabled');
      return res.status(400).json({ message: "Missing refresh token" }).end();
    }

    // For JWT-based logout with CSRF protection
    if (refreshToken && !refreshTokenBody && !ensureCsrf({ req, res, cookieName: COOKIE_CSRF })) {
      console.log('[LOGOUT] CSRF validation failed');
      return;
    }

    // Revoke refresh token if present (JWT-based sessions)
    if (refreshToken) {
      console.log('[LOGOUT] Revoking refresh token');
      authSessionService.revokeRefreshSession({ refreshToken });
    } else {
      console.log('[LOGOUT] No refresh token, using SSO session logout');
    }

    // Destroy session if it exists (deletes from Redis if SSO_REDIS_ENABLED=true)
    if (req.session) {
      const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'connect.sid';
      const sessionId = req.sessionID;
      const ssoRedisEnabled = process.env.SSO_REDIS_ENABLED === 'true';

      console.log(`[LOGOUT] About to destroy session: ${sessionId} (SSO_REDIS_ENABLED=${ssoRedisEnabled})`);
      console.log(`[LOGOUT] Session destroy function type: ${typeof req.session.destroy}`);

      req.session.destroy((err) => {
        if (err) {
          console.error('[LOGOUT] Error destroying session:', err);
          console.error('[LOGOUT] Error stack:', err.stack);
        } else {
          console.log(`[LOGOUT] Session destroy callback executed successfully`);
          console.log(`[LOGOUT] Session destroyed from ${ssoRedisEnabled ? 'Redis' : 'memory store'}`);
        }

        // Clear all possible session cookies (Spring Session uses various names)
        const cookiesToClear = [sessionCookieName, 'SESSIONID', 'SESSION', 'JSESSIONID', 'connect.sid'];
        cookiesToClear.forEach(cookieName => {
          res.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: process.env.COOKIE_SAMESITE || 'lax'
          });
        });

        console.log('[LOGOUT] All session cookies cleared:', cookiesToClear.join(', '));

        // Clear JWT cookies
        cookies.clearAuthCookies(res);
        console.log('[LOGOUT] JWT cookies cleared');

        // Send response after session is destroyed
        console.log('[LOGOUT] Sending logout response');
        return res.status(200).json({ message: "Logged out" }).end();
      });
    } else {
      // No session, just clear JWT cookies
      console.log('[LOGOUT] No session found on request object, clearing JWT cookies only');
      cookies.clearAuthCookies(res);
      return res.status(200).json({ message: "Logged out" }).end();
    }
  }

  function me(req, res) {
    // This endpoint requires authentication (handled by middleware in app.js)
    if (req.user && req.user.username) {
      return res.status(200).json({
        username: req.user.username,
        videoPath: req.user.videoPath
      }).end();
    }
    return res.status(401).json({ message: "Not authenticated" }).end();
  }

  function getOAuth2Config(req, res) {
    // Return OAuth2 configuration for the frontend
    const oauth2GoogleUrl = process.env.OAUTH2_GOOGLE_URL;

    if (!oauth2GoogleUrl) {
      return res.status(200).json({
        enabled: false
      }).end();
    }

    return res.status(200).json({
      enabled: true,
      googleUrl: oauth2GoogleUrl
    }).end();
  }

  return router;
}
