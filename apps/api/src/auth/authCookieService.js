import { buildCookieOptions } from "./cookiePolicy";

const DEFAULT_COOKIE_NAMES = {
  access: "access_token",
  refresh: "refresh_token",
  csrf: "csrf_token",
};

export function createAuthCookieService({
  cfg,
  cookieNames = DEFAULT_COOKIE_NAMES,
} = {}) {
  const accessCookieOptions = buildCookieOptions({ isHttpOnly: true, cfg });
  const refreshCookieOptions = buildCookieOptions({
    isHttpOnly: true,
    path: "/auth",
    cfg,
  });
  const csrfCookieOptions = buildCookieOptions({ isHttpOnly: false, cfg });

  function setAuthCookies({ res, session }) {
    res.cookie(cookieNames.access, session.accessToken, accessCookieOptions);
    res.cookie(cookieNames.refresh, session.refreshToken, refreshCookieOptions);
    res.cookie(cookieNames.csrf, session.csrfToken, csrfCookieOptions);
  }

  function clearAuthCookies(res) {
    res.clearCookie(cookieNames.access, accessCookieOptions);
    res.clearCookie(cookieNames.refresh, refreshCookieOptions);
    res.clearCookie(cookieNames.csrf, csrfCookieOptions);
  }

  return {
    setAuthCookies,
    clearAuthCookies,
  };
}

