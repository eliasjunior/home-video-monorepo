import session from "express-session";
import { createClient } from "redis";
import RedisStore from "connect-redis";
import SpringSessionStore from "./springSessionStore.js";

const ssoRedisEnabled = process.env.SSO_REDIS_ENABLED === "true";
const useSpringSession = process.env.USE_SPRING_SESSION === "true";
const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || "session-secret";
const sessionTtl = parseInt(process.env.SESSION_TTL || "86400", 10); // 24 hours default
const sessionCookieName = process.env.SESSION_COOKIE_NAME || "connect.sid";
const springSessionPrefix = process.env.SPRING_SESSION_PREFIX || "spring:session:sessions:";

let redisClient = null;

// Create Redis client if SSO is enabled
async function initializeRedisClient() {
  if (!ssoRedisEnabled) {
    console.log("Redis SSO is disabled");
    return null;
  }

  try {
    const client = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
      password: redisPassword || undefined,
    });

    client.on("error", (err) => {
      console.error("Redis client error:", err);
    });

    client.on("connect", () => {
      console.log(`Redis client connected to ${redisHost}:${redisPort}`);
    });

    await client.connect();
    redisClient = client;
    return client;
  } catch (error) {
    console.error("Failed to initialize Redis client:", error);
    throw error;
  }
}

// Create session middleware
export async function createSessionMiddleware() {
  if (!ssoRedisEnabled) {
    // Use memory store for sessions when Redis is disabled
    console.log("[SESSION] Using memory store for sessions (SSO_REDIS_ENABLED=false)");
    console.log(`[SESSION] Cookie name: ${sessionCookieName}, TTL: ${sessionTtl}s`);
    return session({
      name: sessionCookieName,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
        httpOnly: true,
        maxAge: sessionTtl * 1000,
        sameSite: process.env.COOKIE_SAMESITE || "lax",
      },
    });
  }

  // Use Redis store for sessions
  console.log("[SESSION] Initializing Redis store for sessions (SSO_REDIS_ENABLED=true)");
  console.log(`[SESSION] Redis config: host=${redisHost}, port=${redisPort}, hasPassword=${!!redisPassword}`);
  console.log(`[SESSION] Use Spring Session: ${useSpringSession}`);

  const client = await initializeRedisClient();

  let redisStore;
  if (useSpringSession) {
    // Use Spring Session compatible store (read-only)
    console.log(`[SESSION] Using SpringSessionStore with prefix: ${springSessionPrefix}`);
    redisStore = new SpringSessionStore({
      client: client,
      prefix: springSessionPrefix,
      ttl: sessionTtl,
    });
  } else {
    // Use standard express-session store
    console.log("[SESSION] Using standard RedisStore with prefix: sess:");
    redisStore = new RedisStore({
      client: client,
      prefix: "sess:",
      ttl: sessionTtl,
    });
  }

  console.log(`[SESSION] Redis store created - Cookie name: ${sessionCookieName}, TTL: ${sessionTtl}s`);

  const sessionConfig = {
    name: sessionCookieName,
    store: redisStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
      httpOnly: true,
      maxAge: sessionTtl * 1000,
      sameSite: process.env.COOKIE_SAMESITE || "lax",
    },
  };

  const sessionMiddleware = session(sessionConfig);

  // For Spring Session: wrap middleware to handle unsigned cookies
  if (useSpringSession) {
    console.log("[SESSION] Wrapping middleware for Spring Session unsigned cookie support");

    return async (req, res, next) => {
      // Parse Spring SESSION cookie manually before express-session processes it
      const cookies = req.headers.cookie;
      let springSessionId = null;

      if (cookies) {
        // Try multiple cookie name patterns: SESSION, SESSIONID, or the configured name
        // Use word boundaries (\b) to match exact cookie names only
        const cookiePatterns = [
          new RegExp(`\\b${sessionCookieName}=([^;]+)`),
          /\bSESSIONID=([^;]+)/,
          /\bSESSION=([^;]+)/
        ];

        for (const pattern of cookiePatterns) {
          const match = cookies.match(pattern);
          if (match) {
            springSessionId = match[1];
            console.log(`[SESSION] Detected Spring session cookie (${pattern.source}): ${springSessionId}`);
            break;
          }
        }

        if (!springSessionId) {
          console.log(`[SESSION] No Spring session cookie found in: ${cookies.substring(0, 100)}`);
        }
      }

      // If we have a Spring session cookie, manually load the session from Redis
      let sessionFound = false;
      if (springSessionId) {
        try {
          // Call the store's get method directly
          await new Promise((resolve, reject) => {
            redisStore.get(springSessionId, (err, sessionData) => {
              if (err) {
                console.error(`[SESSION] Error loading Spring session:`, err);
                return reject(err);
              }

              if (sessionData) {
                console.log(`[SESSION] Loaded Spring session data for: ${sessionData.user?.username}`);
                sessionFound = true;

                // Manually create the session object on the request
                req.sessionID = springSessionId;
                req.session = sessionData;

                // Add session methods
                req.session.regenerate = (cb) => cb && cb();
                req.session.destroy = (cb) => {
                  redisStore.destroy(springSessionId, cb || (() => {}));
                };
                req.session.reload = (cb) => cb && cb();
                req.session.save = (cb) => cb && cb();
                req.session.touch = () => {};

                resolve();
              } else {
                console.log(`[SESSION] No Spring session found for ID: ${springSessionId} (session may be expired or invalid)`);
                // Clear the invalid session cookie
                res.clearCookie("SESSIONID", { path: "/" });
                res.clearCookie(sessionCookieName, { path: "/" });
                console.log(`[SESSION] Cleared invalid session cookies`);
                resolve();
              }
            });
          });
        } catch (error) {
          console.error(`[SESSION] Failed to load Spring session:`, error);
        }
      }

      // If session was loaded from Spring, skip express-session middleware
      if (sessionFound && req.session && req.session.authenticated) {
        console.log(`[SESSION] Using loaded Spring session, skipping express-session`);
        return next();
      }

      // If Spring session was not found, treat as unauthenticated
      if (springSessionId && !sessionFound) {
        console.log(`[SESSION] Spring session expired, treating as unauthenticated`);
        // Don't create a new express-session, just continue without session
        req.session = null;
        req.sessionID = null;
        return next();
      }

      // Otherwise, use express-session middleware normally (for non-Spring sessions)
      sessionMiddleware(req, res, next);
    };
  }

  return sessionMiddleware;
}

// Cleanup function
export async function closeRedisConnection() {
  if (redisClient) {
    await redisClient.quit();
    console.log("Redis connection closed");
  }
}

export { ssoRedisEnabled, sessionCookieName };
