import { Store } from "express-session";
import { createClient } from "redis";

/**
 * Custom session store to read Spring Session data from Redis
 * Spring Session uses Hash structure: spring:session:sessions:{sessionId}
 * Express Session expects JSON string
 */
class SpringSessionStore extends Store {
  constructor(options = {}) {
    super(options);
    this.client = options.client;
    this.prefix = options.prefix || "spring:session:sessions:";
    this.ttl = options.ttl || 86400;
    this.serializer = options.serializer || JSON;
  }

  /**
   * Get session data from Redis
   * Spring Session stores as Hash with fields like:
   * - sessionAttr:SPRING_SECURITY_CONTEXT
   * - creationTime
   * - lastAccessedTime
   * - principalName (indexed field for username)
   */
  async get(sessionId, callback) {
    const key = this.prefix + sessionId;
    console.log(`[SPRING_SESSION] Looking up session: ${key}`);

    try {
      // Get all hash fields
      const data = await this.client.hGetAll(key);

      if (!data || Object.keys(data).length === 0) {
        console.log(`[SPRING_SESSION] Session not found in Redis (likely expired or user not logged in): ${sessionId}`);
        return callback(null, null);
      }

      console.log(`[SPRING_SESSION] Raw session data fields:`, Object.keys(data));

      // Spring Session with indexed repository stores principalName for quick lookup
      const principalName = data["principalName"] || data["spring:session:principalName"];

      if (principalName) {
        console.log(`[SPRING_SESSION] Found principalName: ${principalName}`);
      }

      // Parse Spring Security Context
      const securityContextKey = "sessionAttr:SPRING_SECURITY_CONTEXT";
      const securityContextData = data[securityContextKey];

      // If no security context, this is a pre-authentication session (not logged in)
      if (!securityContextData) {
        console.log(`[SPRING_SESSION] No SPRING_SECURITY_CONTEXT found - session is not authenticated`);
        return callback(null, null);
      }

      let username = principalName || "unknown";
      let authorities = ["ROLE_USER"];

      if (securityContextData) {
        console.log(`[SPRING_SESSION] Processing SPRING_SECURITY_CONTEXT (${securityContextData.length} bytes)`);

        // Try to extract information from the serialized data
        // Spring uses Java serialization, but we can try to find text patterns
        try {
          // The data is likely a binary buffer or base64 string
          let buffer;
          if (Buffer.isBuffer(securityContextData)) {
            buffer = securityContextData;
          } else if (typeof securityContextData === "string") {
            // Try as-is first (might be JSON)
            if (securityContextData.startsWith("{")) {
              const json = JSON.parse(securityContextData);

              // Spring Security context structure: {authentication: {principal: {...}, authorities: [...]}}
              const auth = json.authentication || json;
              const principal = auth.principal || json.principal;

              if (principal) {
                username = principal.email || principal.username || username;
                console.log(`[SPRING_SESSION] Found principal:`, principal.email || principal.username);
              }

              // Extract authorities from authentication
              if (auth.authorities && Array.isArray(auth.authorities)) {
                // Spring returns authorities as array with type info: ["java.util.Collections$...", [{role: "ROLE_ADMIN"}, ...]]
                const authArray = auth.authorities.length > 1 ? auth.authorities[1] : auth.authorities[0];
                if (Array.isArray(authArray)) {
                  authorities = authArray.map(a => {
                    if (typeof a === "string") return a;
                    return a.role || a.authority || a;
                  }).filter(Boolean);
                }
              }

              console.log(`[SPRING_SESSION] Parsed JSON - username: ${username}, authorities:`, authorities);
            } else {
              // Try base64 decode
              try {
                buffer = Buffer.from(securityContextData, "base64");
              } catch {
                buffer = Buffer.from(securityContextData);
              }
            }
          }

          // If we have a buffer, try to extract username as text
          if (buffer) {
            const text = buffer.toString("utf8", 0, Math.min(buffer.length, 1000));
            // Log sample for debugging
            console.log(`[SPRING_SESSION] Buffer sample (first 200 chars):`,
              text.substring(0, 200).replace(/[^\x20-\x7E]/g, "."));

            // Try to find username in the serialized data
            // Look for email patterns or username strings
            const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (emailMatch) {
              username = emailMatch[1];
              console.log(`[SPRING_SESSION] Extracted email from context: ${username}`);
            }

            // Look for ROLE_ patterns
            const roleMatches = text.match(/ROLE_[A-Z_]+/g);
            if (roleMatches) {
              authorities = roleMatches;
              console.log(`[SPRING_SESSION] Extracted authorities: ${authorities}`);
            }
          }
        } catch (parseError) {
          console.error(`[SPRING_SESSION] Failed to parse security context:`, parseError.message);
        }
      }

      // Convert Spring Session format to Express Session format
      const session = {
        authenticated: true,
        user: {
          id: username,
          username: username,
          email: username,
          authorities: authorities,
          accountNonLocked: true,
          accountNonExpired: true,
          credentialsNonExpired: true,
          enabled: true,
        },
        creationTime: data.creationTime,
        lastAccessedTime: data.lastAccessedTime,
        maxInactiveInterval: data.maxInactiveInterval,
        cookie: {
          originalMaxAge: this.ttl * 1000,
          expires: new Date(Date.now() + this.ttl * 1000),
          httpOnly: true,
          path: "/",
        },
      };

      console.log(`[SPRING_SESSION] Converted session for user: ${session.user.username}`);
      callback(null, session);
    } catch (error) {
      console.error(`[SPRING_SESSION] Error getting session:`, error);
      callback(error);
    }
  }

  /**
   * Set session data - Not implemented for read-only SSO
   */
  async set(sessionId, session, callback) {
    console.log(`[SPRING_SESSION] Set operation not supported (read-only mode)`);
    callback(new Error("Spring Session store is read-only"));
  }

  /**
   * Destroy session - delegate to Spring app
   */
  async destroy(sessionId, callback) {
    const key = this.prefix + sessionId;
    console.log(`[SPRING_SESSION] Destroying session: ${key}`);

    try {
      await this.client.del(key);
      // Also delete the expiration key used by Spring Session
      await this.client.del(`${this.prefix}expirations:${sessionId}`);
      callback(null);
    } catch (error) {
      console.error(`[SPRING_SESSION] Error destroying session:`, error);
      callback(error);
    }
  }

  /**
   * Touch session - update last accessed time
   */
  async touch(sessionId, session, callback) {
    const key = this.prefix + sessionId;
    console.log(`[SPRING_SESSION] Touching session: ${key}`);

    try {
      const now = Date.now();
      await this.client.hSet(key, "lastAccessedTime", now.toString());
      callback(null);
    } catch (error) {
      console.error(`[SPRING_SESSION] Error touching session:`, error);
      callback(error);
    }
  }
}

export default SpringSessionStore;
