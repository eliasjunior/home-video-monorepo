export function buildCookieOptions({ isHttpOnly, maxAgeMs, path = "/", cfg }) {
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

