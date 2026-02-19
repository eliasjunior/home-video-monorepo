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

            if (csrfToken) {
              console.log(`[LOGIN] CSRF token obtained, authenticating...`);

              // Step 2: Call external authentication service with CSRF token
              const response = await fetch(secondRetryUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-TOKEN": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({ username, password }),
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
    authSessionService.revokeRefreshSession({ refreshToken });

    cookies.clearAuthCookies(res);
    return res.status(200).json({ message: "Logged out" }).end();
  }

  return router;
}
