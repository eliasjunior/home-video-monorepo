import fs from "fs";
import path from "path";
import { logD } from "../common/MessageUtil.js";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

/**
 * User storage structure (application-level users)
 * {
 *   "username": {
 *     "id": "unique-id",
 *     "username": "username",
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "videoPath": "/mnt-host/users/username"
 *   }
 * }
 */

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logD(`[USER_STORE] Created data directory: ${dataDir}`);
  }
}

// Initialize users file if it doesn't exist
function ensureUsersFile() {
  ensureDataDirectory();
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
    logD(`[USER_STORE] Created users file: ${USERS_FILE}`);
  }
}

// Read all users from file
function readUsers() {
  ensureUsersFile();
  try {
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`[USER_STORE] Error reading users file:`, error.message);
    return {};
  }
}

// Write users to file
function writeUsers(users) {
  ensureUsersFile();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    logD(`[USER_STORE] Updated users file`);
  } catch (error) {
    console.error(`[USER_STORE] Error writing users file:`, error.message);
  }
}

/**
 * Get user by username
 * @param {string} username
 * @returns {Object|null}
 */
export function getUser(username) {
  const users = readUsers();
  return users[username] || null;
}

/**
 * Create or update user
 * @param {string} username
 * @param {Object} userData - Additional user data
 * @returns {Object} The created/updated user
 */
export function upsertUser(username, userData = {}) {
  const users = readUsers();

  const existingUser = users[username];
  if (existingUser) {
    logD(`[USER_STORE] User already exists: ${username}`);
    return existingUser;
  }

  const baseVideoPath = process.env.VIDEO_PATH || "/mnt-host";
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  const userVideoPath = multiUserEnabled
    ? path.join(baseVideoPath, username)
    : baseVideoPath;

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    username,
    createdAt: new Date().toISOString(),
    videoPath: userVideoPath,
    ...userData,
  };

  users[username] = newUser;
  writeUsers(users);

  logD(`[USER_STORE] Created new user: ${username}`);
  return newUser;
}

/**
 * Get all users
 * @returns {Array<Object>}
 */
export function getAllUsers() {
  const users = readUsers();
  return Object.values(users);
}

/**
 * Delete user
 * @param {string} username
 * @returns {boolean} true if deleted, false if not found
 */
export function deleteUser(username) {
  const users = readUsers();
  if (users[username]) {
    delete users[username];
    writeUsers(users);
    logD(`[USER_STORE] Deleted user: ${username}`);
    return true;
  }
  return false;
}
