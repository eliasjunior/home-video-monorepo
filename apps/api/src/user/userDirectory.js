import fs from "fs";
import path from "path";
import { logD } from "../common/MessageUtil.js";

/**
 * Ensure user-specific directory structure exists
 * Creates: <baseVideoPath>/<username>/Movies
 *          <baseVideoPath>/<username>/Series
 *
 * @param {string} username
 * @returns {Object} { moviesPath, seriesPath }
 */
export function ensureUserDirectory(username) {
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  if (!multiUserEnabled) {
    logD(`[USER_DIR] Multi-user mode disabled, skipping directory creation for: ${username}`);
    return null;
  }

  const baseVideoPath = process.env.VIDEO_PATH || "/mnt-host";
  const userBasePath = path.join(baseVideoPath, username);
  const moviesPath = path.join(userBasePath, "Movies");
  const seriesPath = path.join(userBasePath, "Series");

  try {
    // Create user base directory
    if (!fs.existsSync(userBasePath)) {
      fs.mkdirSync(userBasePath, { recursive: true });
      logD(`[USER_DIR] Created user base directory: ${userBasePath}`);
    }

    // Create Movies subdirectory
    if (!fs.existsSync(moviesPath)) {
      fs.mkdirSync(moviesPath, { recursive: true });
      logD(`[USER_DIR] Created Movies directory: ${moviesPath}`);
    }

    // Create Series subdirectory
    if (!fs.existsSync(seriesPath)) {
      fs.mkdirSync(seriesPath, { recursive: true });
      logD(`[USER_DIR] Created Series directory: ${seriesPath}`);
    }

    logD(`[USER_DIR] User directory structure ready for: ${username}`);
    return { moviesPath, seriesPath, userBasePath };
  } catch (error) {
    console.error(`[USER_DIR] Error creating directories for user ${username}:`, error.message);
    return null;
  }
}

/**
 * Get user's video path (either dedicated or shared)
 * @param {string} username
 * @returns {string} The base video path for the user
 */
export function getUserVideoPath(username) {
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";
  const baseVideoPath = process.env.VIDEO_PATH || "/mnt-host";

  if (!multiUserEnabled) {
    return baseVideoPath;
  }

  return path.join(baseVideoPath, username);
}

/**
 * Get user's movies directory path
 * @param {string} username
 * @returns {string}
 */
export function getUserMoviesPath(username) {
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  // Ensure directory exists if multi-user mode is enabled
  if (multiUserEnabled) {
    ensureUserDirectory(username);
  }

  const basePath = getUserVideoPath(username);
  const moviesDir = process.env.MOVIES_DIR || "Movies";
  return path.join(basePath, moviesDir);
}

/**
 * Get user's series directory path
 * @param {string} username
 * @returns {string}
 */
export function getUserSeriesPath(username) {
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  // Ensure directory exists if multi-user mode is enabled
  if (multiUserEnabled) {
    ensureUserDirectory(username);
  }

  const basePath = getUserVideoPath(username);
  const seriesDir = process.env.SERIES_DIR || "Series";
  return path.join(basePath, seriesDir);
}
