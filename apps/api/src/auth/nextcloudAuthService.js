import { logD } from "../common/MessageUtil.js";

/**
 * Nextcloud Authentication Service
 * Supports authentication via Nextcloud App Password (WebDAV)
 */

/**
 * Authenticate user with Nextcloud using App Password via WebDAV
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

    // Test authentication using Nextcloud's WebDAV endpoint
    // This is the most reliable way to verify credentials
    const webdavUrl = `${baseUrl}/remote.php/dav/files/${username}/`;

    logD(`[NEXTCLOUD_AUTH] Attempting to authenticate user: ${username}`);
    logD(`[NEXTCLOUD_AUTH] WebDAV URL: ${webdavUrl}`);

    // Create Basic Auth header
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    const response = await fetch(webdavUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Depth': '0',
        'Content-Type': 'application/xml'
      }
    });

    if (response.status === 207 || response.status === 200) {
      // Multi-Status or OK response means authentication succeeded
      logD(`[NEXTCLOUD_AUTH] Authentication successful for user: ${username}`);
      return {
        success: true,
        username: username
      };
    } else if (response.status === 401) {
      logD(`[NEXTCLOUD_AUTH] Authentication failed: Invalid credentials`);
      return {
        success: false,
        error: "Invalid Nextcloud username or app password"
      };
    } else {
      logD(`[NEXTCLOUD_AUTH] Authentication failed with status: ${response.status}`);
      return {
        success: false,
        error: `Authentication failed: ${response.statusText}`
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
    const userInfoUrl = `${baseUrl}/ocs/v1.php/cloud/user?format=json`;

    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'OCS-APIRequest': 'true'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ocs && data.ocs.data) {
        return {
          displayName: data.ocs.data.displayname || username,
          email: data.ocs.data.email || `${username}@nextcloud.local`
        };
      }
    }

    // Fallback if we can't get user info
    return {
      displayName: username,
      email: `${username}@nextcloud.local`
    };
  } catch (error) {
    logD(`[NEXTCLOUD_AUTH] Error fetching user info:`, error);
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

    // Default prefix if not provided
    const prefix = nextcloudSessionPrefix || process.env.NEXTCLOUD_SESSION_PREFIX || 'nc_session:';

    // Try both Nextcloud format and Spring Session format
    const sessionKeys = [
      `${prefix}${sessionId}`,                      // Nextcloud format: nc_session:abc123
      `spring:session:sessions:${sessionId}`,        // Spring Session format
    ];

    console.log(`[NEXTCLOUD_AUTH] Checking Nextcloud/Spring session with ID: ${sessionId}`);
    console.log(`[NEXTCLOUD_AUTH] Will try keys: ${sessionKeys.join(', ')}`);

    for (const sessionKey of sessionKeys) {
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
          logD(`[NEXTCLOUD_AUTH] Session data is not JSON, trying PHP serialized format`);

          // PHP serialized format: look for user_id in serialized data
          // Example: s:7:"user_id";s:5:"admin";
          const patterns = [
            /s:\d+:"user_id";s:\d+:"([^"]+)"/,           // PHP serialized string
            /user_id["|']?\s*[:=]\s*["']([^"']+)/,        // Key-value pairs
            /"user_id":"([^"]+)"/,                         // JSON-like in string
            /login_name["|']?\s*[:=]\s*["']([^"']+)/,     // Alternative user field
          ];

          for (const pattern of patterns) {
            const match = sessionData.match(pattern);
            if (match && match[1]) {
              logD(`[NEXTCLOUD_AUTH] Found Nextcloud PHP session for user: ${match[1]}`);
              return { authenticated: true, username: match[1] };
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
 * @param {string} appPassword - Nextcloud app password
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @param {Object} options - Optional filters
 * @param {boolean} options.sharedWithMe - Get files shared with user (default: true)
 * @param {boolean} options.sharedByMe - Get files shared by user (default: false)
 * @param {string} options.path - Filter by path
 * @param {boolean} options.videosOnly - Filter to video files only (default: true)
 * @returns {Promise<{success: boolean, shares?: Array, error?: string}>}
 */
export async function getNextcloudShares({ username, appPassword, nextcloudUrl, options = {} }) {
  try {
    if (!nextcloudUrl || !username || !appPassword) {
      return { success: false, error: "Missing required parameters" };
    }

    const baseUrl = nextcloudUrl.replace(/\/$/, "");
    const {
      sharedWithMe = true,
      sharedByMe = false,
      path = null,
      videosOnly = true
    } = options;

    logD(`[NEXTCLOUD_SHARES] Fetching shares for user: ${username}`);

    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    const shares = [];

    // Get shares shared with user
    if (sharedWithMe) {
      const sharedWithMeUrl = `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?shared_with_me=true&format=json`;

      logD(`[NEXTCLOUD_SHARES] Fetching shares shared with user: ${sharedWithMeUrl}`);

      const response = await fetch(sharedWithMeUrl, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${auth}`,
          "OCS-APIRequest": "true"
        }
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
        headers: {
          "Authorization": `Basic ${auth}`,
          "OCS-APIRequest": "true"
        }
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
 * @param {string} appPassword - Nextcloud app password
 * @param {string} nextcloudUrl - Nextcloud base URL
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
export async function getSharedVideoFiles({ username, appPassword, nextcloudUrl }) {
  try {
    const result = await getNextcloudShares({
      username,
      appPassword,
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
