import { getCookie } from "../common/Util";

export function ensureCsrf({
  req,
  res,
  cookieName = "csrf_token",
  headerName = "x-csrf-token",
} = {}) {
  const csrfHeader = req.headers[headerName];
  const csrfCookie = getCookie(req, cookieName);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    res.status(403).json({ message: "Invalid CSRF token" }).end();
    return false;
  }
  return true;
}

