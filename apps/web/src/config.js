const { NODE_ENV, REACT_APP_SERVER_PROTOCOL, REACT_APP_SERVER_HOST } =
  process.env;

export default function config() {
  const result = {};

  const fallbackHost =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const host =
    REACT_APP_SERVER_HOST ||
    (NODE_ENV === "development" ? fallbackHost : "");
  if (!host && NODE_ENV === "production") {
    throw new Error(
      "REACT_APP_SERVER_HOST is required in production to avoid localhost fallback"
    );
  }
  if (NODE_ENV !== "test") {
    console.log(`Local IP address written to .env: ${host}`);
    console.log(`React server host => ${host}`);
    console.log(`Env => ${NODE_ENV}`);
  }
  if (NODE_ENV === "production") {
    const defaultProtocol =
      typeof window !== "undefined"
        ? window.location.protocol.replace(":", "")
        : "https";
    result.PROTOCOL = REACT_APP_SERVER_PROTOCOL || defaultProtocol;
    result.PORT = process.env.PORT || 8080;
    result.host = host;
  } else {
    result.PROTOCOL = "http";
    result.PORT = 8080;
    result.host = host; // testing purposes, pointing to prod
  }
  result.SERVER_URL = `${result.PROTOCOL}://${result.host}:${result.PORT}`;
  return result;
}
