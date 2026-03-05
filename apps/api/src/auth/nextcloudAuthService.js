import { logD } from "../common/MessageUtil.js";
import phpUnserialize from "php-session-unserialize";

/**
 * Nextcloud Authentication Service
 * Supports:
 * 1. SSO via OAuth2/SAML (preferred) - uses shared Redis session
 * 2. App Password authentication (fallback) - for API access without browser
 */

/**
 * Authenticate user with Nextcloud using OAuth2 token
 * This method uses the existing Nextcloud session from Redis (preferred method)
 * @param {Object} redisClient - Redis client instance
 * @param {string} sessionId - Session ID from cookie
 * @param {string} nextcloudSessionPrefix - Redis session prefix
 * @returns {Promise<{success: boolean, username?: string, error?: string}>}
 */
export async function authenticateWithNextcloudSession({ redisClient, sessionId, nextcloudSessionPrefix }) {
  return await checkNextcloudRedisSession({ redisClient, sessionId, nextcloudSessionPrefix });
}

/**
 * Authenticate user with Nextcloud using App Password (fallback method)
 * Note: This should only be used for initial authentication or API access
 * For web app access, use OAuth2/SAML SSO instead
 * @param {string} username - Nextcloud username
 * @param {string} appPassword - Nextcloud app password
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @returns {Promise<{success: boolean, username: string, error?: string}>}
 */
export async function authenticateWithNextcloud({ username, appPassword, nextcloudUrl }) {
  try {
    if (!nextcloudUrl) {
      return { success: false, error: "Nextcloud URL not configured" };
    }

    // Remove trailing slash from URL
    const baseUrl = nextcloudUrl.replace(/\/$/, '');

    // URL-encode the username for use in the path (important for emails with @)
    const encodedUsername = encodeURIComponent(username);

    // Test authentication using Nextcloud's capabilities endpoint
    // This endpoint is available on all Nextcloud versions and doesn't require special permissions
    const statusUrl = `${baseUrl}/ocs/v2.php/cloud/capabilities?format=json`;

    console.log(`[NEXTCLOUD_AUTH] Attempting to authenticate user: ${username}`);
    console.log(`[NEXTCLOUD_AUTH] Nextcloud base URL: ${baseUrl}`);
    console.log(`[NEXTCLOUD_AUTH] Capabilities URL: ${statusUrl}`);
    console.log(`[NEXTCLOUD_AUTH] App password length: ${appPassword?.length || 0} characters`);

    if (!appPassword || appPassword.length < 20) {
      console.error(`[NEXTCLOUD_AUTH] App password seems invalid (too short: ${appPassword?.length || 0} chars)`);
      return {
        success: false,
        error: "App password is invalid or too short. Nextcloud app passwords are typically 72+ characters. Please generate a proper app password from Nextcloud settings."
      };
    }

    // Create Basic Auth header
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
    console.log(`[NEXTCLOUD_AUTH] Basic auth header created`);

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true'
      }
    });

    console.log(`[NEXTCLOUD_AUTH] Response status: ${response.status} ${response.statusText}`);

    if (response.status === 200) {
      // OK response means authentication succeeded
      const data = await response.json().catch(() => null);

      // Verify that we got valid OCS response (capabilities endpoint returns version info)
      if (data && data.ocs && data.ocs.meta && data.ocs.meta.status === 'ok') {
        console.log(`[NEXTCLOUD_AUTH] Authentication successful for user: ${username}`);

        // Try to get user info from a separate endpoint
        const userInfo = await getNextcloudUserInfo({ username, appPassword, nextcloudUrl }).catch(() => ({}));

        return {
          success: true,
          username: username,
          displayName: userInfo.displayName || username,
          email: userInfo.email
        };
      }

      // Response was 200 but no valid OCS data - still consider it authenticated
      console.log(`[NEXTCLOUD_AUTH] Authentication successful (capabilities check passed)`);
      return {
        success: true,
        username: username
      };
    } else if (response.status === 401 || response.status === 403) {
      console.log(`[NEXTCLOUD_AUTH] Authentication failed: Invalid credentials`);
      return {
        success: false,
        error: "Invalid Nextcloud username or app password"
      };
    } else {
      const responseText = await response.text().catch(() => '');
      console.error(`[NEXTCLOUD_AUTH] Authentication failed with status: ${response.status} ${response.statusText}`);
      console.error(`[NEXTCLOUD_AUTH] Response body: ${responseText.substring(0, 500)}`);
      return {
        success: false,
        error: `Authentication failed: ${response.statusText || response.status}`
      };
    }
  } catch (error) {
    console.error(`[NEXTCLOUD_AUTH] Error during authentication:`, error);
    return {
      success: false,
      error: "Failed to connect to Nextcloud server"
    };
  }
}

/**
 * Get user info from Nextcloud
 * @param {string} username - Nextcloud username
 * @param {string} appPassword - Nextcloud app password
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @returns {Promise<{displayName?: string, email?: string}>}
 */
export async function getNextcloudUserInfo({ username, appPassword, nextcloudUrl }) {
  try {
    const baseUrl = nextcloudUrl.replace(/\/$/, '');
    const userInfoUrl = `${baseUrl}/ocs/v2.php/cloud/user?format=json`;

    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    console.log(`[NEXTCLOUD_AUTH] Fetching user info from: ${userInfoUrl}`);

    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true'
      }
    });

    console.log(`[NEXTCLOUD_AUTH] User info response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      if (data.ocs && data.ocs.data) {
        console.log(`[NEXTCLOUD_AUTH] User info retrieved: ${data.ocs.data.displayname || username}`);
        return {
          displayName: data.ocs.data.displayname || username,
          email: data.ocs.data.email || `${username}@nextcloud.local`
        };
      }
    }

    // Fallback if we can't get user info
    console.log(`[NEXTCLOUD_AUTH] Could not fetch user info, using defaults`);
    return {
      displayName: username,
      email: `${username}@nextcloud.local`
    };
  } catch (error) {
    console.error(`[NEXTCLOUD_AUTH] Error fetching user info:`, error.message);
    return {
      displayName: username,
      email: `${username}@nextcloud.local`
    };
  }
}

/**
 * Check if Nextcloud Redis session exists and is valid
 * Supports both Nextcloud native sessions and Spring Session format
 * @param {Object} redisClient - Redis client instance
 * @param {string} sessionId - Session ID from cookie
 * @param {string} nextcloudSessionPrefix - Nextcloud session prefix in Redis (default: NEXTCLOUD_SESSION_PREFIX env var)
 * @returns {Promise<{authenticated: boolean, username?: string}>}
 */
export async function checkNextcloudRedisSession({ redisClient, sessionId, nextcloudSessionPrefix }) {
  try {
    if (!redisClient || !sessionId) {
      return { authenticated: false };
    }

    // Default prefix if not provided (Nextcloud typically uses PHPREDIS_SESSION:)
    const prefix = nextcloudSessionPrefix || process.env.NEXTCLOUD_SESSION_PREFIX || 'PHPREDIS_SESSION:';

    // Try multiple session key formats
    const sessionKeys = [
      `${prefix}${sessionId}`,                          // Configured prefix (default: PHPREDIS_SESSION:abc123)
      `PHPREDIS_SESSION:${sessionId}`,                  // Nextcloud with PHP Redis sessions
      `spring:session:sessions:${sessionId}`,           // Spring Session format
      `nc_session:${sessionId}`,                        // Alternative Nextcloud format
    ];

    // Remove duplicates
    const uniqueKeys = [...new Set(sessionKeys)];

    console.log(`[NEXTCLOUD_AUTH] Checking Nextcloud/Spring session with ID: ${sessionId}`);
    console.log(`[NEXTCLOUD_AUTH] Will try keys: ${uniqueKeys.join(', ')}`);

    for (const sessionKey of uniqueKeys) {
      try {
        console.log(`[NEXTCLOUD_AUTH] Trying key: ${sessionKey}`);
        // Get session data from Redis (using promise-based API)
        const sessionData = await redisClient.get(sessionKey);
        console.log(`[NEXTCLOUD_AUTH] Result for ${sessionKey}: ${sessionData ? 'found' : 'not found'}`);

        if (!sessionData) {
          continue; // Try next key format
        }

        logD(`[NEXTCLOUD_AUTH] Found session data at key: ${sessionKey}`);

        // Try parsing as JSON first (Spring Session format)
        try {
          const session = JSON.parse(sessionData);

          // Spring Session format - check for authenticated user
          if (session.sessionAttr && session.sessionAttr['SPRING_SECURITY_CONTEXT']) {
            const securityContext = session.sessionAttr['SPRING_SECURITY_CONTEXT'];
            const username = securityContext.authentication?.principal?.username ||
                           securityContext.authentication?.name;

            if (username) {
              logD(`[NEXTCLOUD_AUTH] Found Spring Session for user: ${username}`);
              return { authenticated: true, username };
            }
          }

          // Alternative Spring Session format
          if (session.user && session.authenticated) {
            const username = session.user.username || session.user.name;
            if (username) {
              logD(`[NEXTCLOUD_AUTH] Found Spring Session (alt format) for user: ${username}`);
              return { authenticated: true, username };
            }
          }

          // Nextcloud JSON format
          const username = session.user_id || session.userId || session.username ||
                          session.user?.id || session.user?.username;

          if (username) {
            logD(`[NEXTCLOUD_AUTH] Found Nextcloud JSON session for user: ${username}`);
            return { authenticated: true, username };
          }

        } catch (jsonError) {
          // Not JSON, try PHP serialized format (Nextcloud native)
          console.log(`[NEXTCLOUD_AUTH] Session data is not JSON, trying PHP session decoder`);

          try {
            // Use php-session-unserialize to parse PHP session data
            const decoded = phpUnserialize(sessionData);
            console.log(`[NEXTCLOUD_AUTH] Decoded PHP session:`, JSON.stringify(decoded).substring(0, 200));

            // Check for encrypted_session_data (Nextcloud uses encryption)
            if (decoded && decoded.encrypted_session_data) {
              console.log(`[NEXTCLOUD_AUTH] Found encrypted session data, attempting to decrypt...`);

              // Nextcloud stores encrypted session data
              // The encrypted data format in your sample shows it's encrypted with a key
              // For now, we can't decrypt without the encryption key from Nextcloud config
              // But we can verify the session exists and is active

              // Try to find username in session data before encryption
              // Sometimes Nextcloud stores login_name or user_id unencrypted
              const username = decoded.user_id || decoded.login_name || decoded.loginname || decoded.user;

              if (username) {
                console.log(`[NEXTCLOUD_AUTH] Found username in PHP session: ${username}`);
                return { authenticated: true, username };
              }

              // If no username found, session exists but we need to get username from elsewhere
              console.log(`[NEXTCLOUD_AUTH] Session exists but username is encrypted`);
              return { authenticated: true, username: null, encrypted: true };
            }

            // Try to find username in decoded session (unencrypted sessions)
            const username = decoded.user_id || decoded.userId || decoded.username ||
                            decoded.login_name || decoded.loginname || decoded.user;

            if (username) {
              console.log(`[NEXTCLOUD_AUTH] Found Nextcloud PHP session for user: ${username}`);
              return { authenticated: true, username };
            }

          } catch (phpDecodeError) {
            console.error(`[NEXTCLOUD_AUTH] Error decoding PHP session:`, phpDecodeError.message);

            // Fallback: use regex patterns for simple PHP serialized format
            const patterns = [
              /s:\d+:"user_id";s:\d+:"([^"]+)"/,           // PHP serialized string
              /user_id["|']?\s*[:=]\s*["']([^"']+)/,        // Key-value pairs
              /"user_id":"([^"]+)"/,                         // JSON-like in string
              /login_name["|']?\s*[:=]\s*["']([^"']+)/,     // Alternative user field
            ];

            for (const pattern of patterns) {
              const match = sessionData.match(pattern);
              if (match && match[1]) {
                console.log(`[NEXTCLOUD_AUTH] Found username via regex: ${match[1]}`);
                return { authenticated: true, username: match[1] };
              }
            }
          }
        }
      } catch (keyError) {
        logD(`[NEXTCLOUD_AUTH] Error checking key ${sessionKey}:`, keyError);
        continue;
      }
    }

    logD(`[NEXTCLOUD_AUTH] No valid Nextcloud/Spring session found`);
    return { authenticated: false };

  } catch (error) {
    console.error(`[NEXTCLOUD_AUTH] Error checking Nextcloud Redis session:`, error);
    return { authenticated: false };
  }
}


/**
 * Get list of shares for authenticated user using OCS Share API
 * @param {string} username - Nextcloud username
 * @param {string} appPassword - Nextcloud app password (optional if using session token)
 * @param {string} sessionToken - Nextcloud session token from Redis (preferred)
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @param {Object} options - Optional filters
 * @param {boolean} options.sharedWithMe - Get files shared with user (default: true)
 * @param {boolean} options.sharedByMe - Get files shared by user (default: false)
 * @param {string} options.path - Filter by path
 * @param {boolean} options.videosOnly - Filter to video files only (default: true)
 * @returns {Promise<{success: boolean, shares?: Array, error?: string}>}
 */
export async function getNextcloudShares({ username, appPassword, sessionToken, nextcloudUrl, options = {} }) {
  try {
    if (!nextcloudUrl || !username) {
      return { success: false, error: "Missing required parameters" };
    }

    if (!appPassword && !sessionToken) {
      return { success: false, error: "Either appPassword or sessionToken is required" };
    }

    const baseUrl = nextcloudUrl.replace(/\/$/, "");
    const {
      sharedWithMe = true,
      sharedByMe = false,
      path = null,
      videosOnly = true
    } = options;

    logD(`[NEXTCLOUD_SHARES] Fetching shares for user: ${username}`);

    // Use session token if available (SSO), otherwise fall back to Basic auth
    const headers = sessionToken
      ? {
          "Cookie": sessionToken,
          "OCS-APIRequest": "true"
        }
      : {
          "Authorization": `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`,
          "OCS-APIRequest": "true"
        };

    const shares = [];

    // Get shares shared with user
    if (sharedWithMe) {
      const sharedWithMeUrl = `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?shared_with_me=true&format=json`;

      logD(`[NEXTCLOUD_SHARES] Fetching shares shared with user: ${sharedWithMeUrl}`);
      logD(`[NEXTCLOUD_SHARES] Using ${sessionToken ? 'session token' : 'Basic auth'}`);

      const response = await fetch(sharedWithMeUrl, {
        method: "GET",
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ocs && data.ocs.data) {
          shares.push(...data.ocs.data);
          logD(`[NEXTCLOUD_SHARES] Found ${data.ocs.data.length} shares shared with user`);
        }
      } else {
        logD(`[NEXTCLOUD_SHARES] Failed to fetch shares shared with user: ${response.status}`);
      }
    }

    // Get shares shared by user
    if (sharedByMe) {
      const sharedByMeUrl = `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`;

      logD(`[NEXTCLOUD_SHARES] Fetching shares created by user: ${sharedByMeUrl}`);

      const response = await fetch(sharedByMeUrl, {
        method: "GET",
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ocs && data.ocs.data) {
          shares.push(...data.ocs.data);
          logD(`[NEXTCLOUD_SHARES] Found ${data.ocs.data.length} shares created by user`);
        }
      } else {
        logD(`[NEXTCLOUD_SHARES] Failed to fetch shares created by user: ${response.status}`);
      }
    }

    // Filter by path if specified
    let filteredShares = shares;
    if (path) {
      filteredShares = shares.filter(share => share.path && share.path.includes(path));
      logD(`[NEXTCLOUD_SHARES] Filtered to ${filteredShares.length} shares matching path: ${path}`);
    }

    // Filter to video files only if requested (default: true)
    const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv", ".flv", ".webm", ".mpg", ".mpeg", ".3gp", ".ts", ".mts"];
    if (videosOnly) {
      filteredShares = filteredShares.filter(share => {
        if (share.item_type !== "file") return false;
        const fileName = (share.file_target || "").toLowerCase();
        const hasVideoExt = videoExtensions.some(ext => fileName.endsWith(ext));
        const hasVideoMime = share.mimetype && share.mimetype.startsWith("video/");
        return hasVideoExt || hasVideoMime;
      });
      logD(`[NEXTCLOUD_SHARES] Filtered to ${filteredShares.length} video files`);
    }

    // Map to simplified format
    const mappedShares = filteredShares.map(share => ({
      id: share.id,
      shareType: share.share_type,
      sharedWith: share.share_with,
      sharedWithDisplayName: share.share_with_displayname,
      path: share.path,
      fileName: share.file_target,
      mimeType: share.mimetype,
      permissions: share.permissions,
      shareTime: share.stime,
      expiration: share.expiration,
      token: share.token,
      url: share.url,
      fileId: share.file_source,
      fileParent: share.file_parent,
      itemType: share.item_type,
      owner: share.uid_owner,
      ownerDisplayName: share.displayname_owner
    }));

    logD(`[NEXTCLOUD_SHARES] Successfully retrieved ${mappedShares.length} shares`);

    return {
      success: true,
      shares: mappedShares
    };

  } catch (error) {
    console.error(`[NEXTCLOUD_SHARES] Error fetching shares:`, error);
    return {
      success: false,
      error: error.message || "Failed to fetch Nextcloud shares"
    };
  }
}

/**
 * Get files shared with user (video files only)
 * @param {string} username - Nextcloud username
 * @param {string} appPassword - Nextcloud app password (optional if using session token)
 * @param {string} sessionToken - Nextcloud session token from Redis (preferred)
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
export async function getSharedVideoFiles({ username, appPassword, sessionToken, nextcloudUrl }) {
  try {
    const result = await getNextcloudShares({
      username,
      appPassword,
      sessionToken,
      nextcloudUrl,
      options: { sharedWithMe: true, sharedByMe: false }
    });

    if (!result.success) {
      return result;
    }

    // Filter for video files only
    const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv", ".flv", ".webm"];
    const videoFiles = result.shares.filter(share => {
      if (share.itemType !== "file") return false;
      const fileName = share.fileName.toLowerCase();
      return videoExtensions.some(ext => fileName.endsWith(ext));
    });

    logD(`[NEXTCLOUD_SHARES] Filtered to ${videoFiles.length} video files`);

    return {
      success: true,
      files: videoFiles
    };

  } catch (error) {
    console.error(`[NEXTCLOUD_SHARES] Error fetching shared video files:`, error);
    return {
      success: false,
      error: error.message || "Failed to fetch shared video files"
    };
  }
}
