/* global globalThis */
const { NODE_ENV, REACT_APP_SERVER_PROTOCOL, REACT_APP_SERVER_HOST } =
  process.env;

export default function config() {
  const result = {};

  const envHost = REACT_APP_SERVER_HOST?.trim();
  const windowRef =
    typeof globalThis !== "undefined" ? globalThis.window : undefined;
  const devHost =
    windowRef && windowRef.location && windowRef.location.hostname
      ? windowRef.location.hostname
      : "localhost";
  const host = NODE_ENV === "development" ? devHost : envHost || "";
  if (!host && NODE_ENV === "production") {
    throw new Error(
      "REACT_APP_SERVER_HOST is required in production to avoid localhost fallback"
    );
  }
  if (NODE_ENV === "development" && envHost && envHost !== devHost) {
    console.warn(
      "REACT_APP_SERVER_HOST is ignored in development; using window.location.hostname instead"
    );
  }
  if (NODE_ENV !== "test") {
    console.log(`Local IP address written to .env: ${host}`);
    console.log(`React server host => ${host}`);
    console.log(`Env => ${NODE_ENV}`);
  }
  const publicUrl = process.env.PUBLIC_URL || '/home-video';

  if (NODE_ENV === "production") {
    // In production, if API and web are served from same server, use window.location
    if (windowRef && windowRef.location) {
      const currentPort = windowRef.location.port || (windowRef.location.protocol === "https:" ? "443" : "80");
      result.PROTOCOL = windowRef.location.protocol.replace(":", "");
      result.PORT = currentPort;
      result.host = windowRef.location.hostname;
      result.SERVER_URL = `${result.PROTOCOL}://${result.host}:${result.PORT}${publicUrl}`;
    } else {
      // Fallback for SSR or non-browser environments
      const defaultProtocol = REACT_APP_SERVER_PROTOCOL || "https";
      result.PROTOCOL = defaultProtocol;
      result.PORT = process.env.PORT || 8080;
      result.host = host;
      result.SERVER_URL = `${result.PROTOCOL}://${result.host}:${result.PORT}${publicUrl}`;
    }
  } else {
    result.PROTOCOL = "http";
    result.PORT = 8080;
    result.host = host; // testing purposes, pointing to prod
    result.SERVER_URL = `${result.PROTOCOL}://${result.host}:${result.PORT}${publicUrl}`;
  }
  return result;
}
