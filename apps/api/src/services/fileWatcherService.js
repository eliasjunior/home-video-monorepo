import fs from "fs";
import path from "path";
import { logD } from "../common/MessageUtil.js";

export function createFileWatcherService({ baseVideosPath, moviesDir, seriesDir }) {
  const watchers = new Map();
  const listeners = new Set();
  const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";

  function notifyListeners(event) {
    logD(`[FILE_WATCHER] Notifying ${listeners.size} listeners of event:`, event);
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[FILE_WATCHER] Error notifying listener:', err);
      }
    });
  }

  function watchDirectory(dirPath, category) {
    if (!fs.existsSync(dirPath)) {
      logD(`[FILE_WATCHER] Directory does not exist, skipping: ${dirPath}`);
      return null;
    }

    try {
      logD(`[FILE_WATCHER] Starting to watch: ${dirPath}`);

      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        logD(`[FILE_WATCHER] ${eventType} detected in ${category}: ${filename}`);

        // Debounce rapid fire events
        const event = {
          type: eventType, // 'rename' or 'change'
          category, // 'movies' or 'series'
          filename,
          path: path.join(dirPath, filename),
          timestamp: Date.now()
        };

        notifyListeners(event);
      });

      watcher.on('error', (error) => {
        console.error(`[FILE_WATCHER] Error watching ${dirPath}:`, error);
      });

      return watcher;
    } catch (error) {
      console.error(`[FILE_WATCHER] Failed to watch ${dirPath}:`, error);
      return null;
    }
  }

  function startWatching() {
    if (multiUserEnabled) {
      // In multi-user mode, watch the base directory recursively
      // This will catch changes in all user subdirectories
      logD(`[FILE_WATCHER] Multi-user mode enabled, watching base path: ${baseVideosPath}`);

      if (!fs.existsSync(baseVideosPath)) {
        logD(`[FILE_WATCHER] Base directory does not exist: ${baseVideosPath}`);
        return;
      }

      const baseWatcher = fs.watch(baseVideosPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Extract username from path (format: username/Movies/... or username/Series/...)
        const pathParts = filename.split(path.sep);
        if (pathParts.length < 2) return;

        const username = pathParts[0];
        const subdir = pathParts[1];

        // Determine category based on subdirectory
        let category = null;
        if (subdir === moviesDir) {
          category = 'movies';
        } else if (subdir === seriesDir) {
          category = 'series';
        }

        if (category && username) {
          logD(`[FILE_WATCHER] ${eventType} detected for user ${username} in ${category}: ${filename}`);
          const event = {
            type: eventType,
            category,
            username,
            filename,
            path: path.join(baseVideosPath, filename),
            timestamp: Date.now()
          };
          notifyListeners(event);
        }
      });

      baseWatcher.on('error', (error) => {
        console.error(`[FILE_WATCHER] Error watching ${baseVideosPath}:`, error);
      });

      watchers.set('base', baseWatcher);
      logD(`[FILE_WATCHER] Started watching base directory for all users`);
    } else {
      // Single-user mode: watch specific movies and series directories
      const moviesPath = path.join(baseVideosPath, moviesDir);
      const seriesPath = path.join(baseVideosPath, seriesDir);

      // Watch movies directory
      const moviesWatcher = watchDirectory(moviesPath, 'movies');
      if (moviesWatcher) {
        watchers.set('movies', moviesWatcher);
      }

      // Watch series directory
      const seriesWatcher = watchDirectory(seriesPath, 'series');
      if (seriesWatcher) {
        watchers.set('series', seriesWatcher);
      }

      logD(`[FILE_WATCHER] Started watching ${watchers.size} directories`);
    }
  }

  function stopWatching() {
    logD(`[FILE_WATCHER] Stopping all watchers`);
    watchers.forEach((watcher, key) => {
      try {
        watcher.close();
        logD(`[FILE_WATCHER] Closed watcher for: ${key}`);
      } catch (err) {
        console.error(`[FILE_WATCHER] Error closing watcher for ${key}:`, err);
      }
    });
    watchers.clear();
  }

  function addListener(callback) {
    listeners.add(callback);
    logD(`[FILE_WATCHER] Added listener. Total listeners: ${listeners.size}`);
    return () => {
      listeners.delete(callback);
      logD(`[FILE_WATCHER] Removed listener. Total listeners: ${listeners.size}`);
    };
  }

  return {
    startWatching,
    stopWatching,
    addListener,
    isWatching: () => watchers.size > 0
  };
}
