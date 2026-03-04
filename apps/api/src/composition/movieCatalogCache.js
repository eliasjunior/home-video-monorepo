import fs from "fs";
import path from "path";
import fileService from "../domain/fileUseCases";
import { getMovieMap, setMovieMap } from "../common/Util";
import { logD } from "../common/MessageUtil";

const VIDEO_CACHE_DIR = path.resolve(process.cwd(), "data");
const VIDEO_CACHE_FILE = path.join(VIDEO_CACHE_DIR, "videos-cache.json");
const DEFAULT_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const movieCatalogCacheState = {
  snapshotLoadedAt: null,
  lastRefreshAt: null,
  lastRefreshStartedAt: null,
  lastRefreshSucceeded: null,
  lastRefreshDurationMs: null,
  lastRefreshError: "",
  lastRefreshReason: "",
  refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  nextScheduledRefreshAt: null,
};

function isValidMovieMap(candidate) {
  return (
    candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    candidate.byId &&
    typeof candidate.byId === "object" &&
    !Array.isArray(candidate.byId) &&
    Array.isArray(candidate.allIds)
  );
}

function getSnapshotFilePath(env = process.env) {
  return env.VIDEO_CACHE_SNAPSHOT_FILE || VIDEO_CACHE_FILE;
}

export function getMovieCatalogCacheStatus({
  env = process.env,
  getMovieMapFn = getMovieMap,
} = {}) {
  const movieMap = getMovieMapFn();
  return {
    ...movieCatalogCacheState,
    snapshotFile: getSnapshotFilePath(env),
    itemCount: Array.isArray(movieMap?.allIds) ? movieMap.allIds.length : 0,
  };
}

export function loadMovieCacheFromSnapshot({
  env = process.env,
  fsRef = fs,
  setMovieMapFn = setMovieMap,
  consoleRef = console,
} = {}) {
  const file = getSnapshotFilePath(env);
  try {
    if (!fsRef.existsSync(file)) {
      return false;
    }
    const raw = fsRef.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!isValidMovieMap(parsed)) {
      consoleRef.warn(`Invalid movie cache snapshot format at ${file}`);
      return false;
    }
    setMovieMapFn(parsed);
    movieCatalogCacheState.snapshotLoadedAt = new Date().toISOString();
    return true;
  } catch (error) {
    consoleRef.warn(
      `Failed to load movie cache snapshot at ${file}: ${error.message}`
    );
    return false;
  }
}

export function persistMovieCacheSnapshot({
  movieMap,
  env = process.env,
  fsRef = fs,
  consoleRef = console,
} = {}) {
  const file = getSnapshotFilePath(env);
  try {
    const dir = path.dirname(file);
    if (!fsRef.existsSync(dir)) {
      fsRef.mkdirSync(dir, { recursive: true });
    }
    fsRef.writeFileSync(file, JSON.stringify(movieMap, null, 2));
    return true;
  } catch (error) {
    consoleRef.warn(
      `Failed to write movie cache snapshot at ${file}: ${error.message}`
    );
    return false;
  }
}

export function refreshMovieCatalogCache({
  appConfig,
  env = process.env,
  reason = "manual",
  fileServiceRef = fileService,
  getMovieMapFn = getMovieMap,
  setMovieMapFn = setMovieMap,
  persistMovieCacheSnapshotFn = persistMovieCacheSnapshot,
  consoleRef = console,
} = {}) {
  const startedAt = Date.now();
  movieCatalogCacheState.lastRefreshStartedAt = new Date(startedAt).toISOString();
  movieCatalogCacheState.lastRefreshReason = reason;
  try {
    const moviesAbsPath = `${appConfig.videosPath}/${appConfig.moviesDir}`;
    const movies = fileServiceRef.getVideos({ baseLocation: moviesAbsPath });
    if (!isValidMovieMap(movies)) {
      consoleRef.warn(
        "Movie cache refresh returned unexpected format. Keeping existing cache."
      );
      movieCatalogCacheState.lastRefreshSucceeded = false;
      movieCatalogCacheState.lastRefreshError = "invalid_movie_map_format";
      return false;
    }
    const hasMovies = movies.allIds.length > 0;
    const current = getMovieMapFn();
    const hasCurrentMovies =
      Array.isArray(current?.allIds) && current.allIds.length > 0;
    if (!hasMovies && hasCurrentMovies) {
      consoleRef.warn(
        `Movie cache refresh returned 0 items from ${moviesAbsPath}. Keeping existing cache.`
      );
      movieCatalogCacheState.lastRefreshSucceeded = false;
      movieCatalogCacheState.lastRefreshError = "empty_scan_with_existing_cache";
      return false;
    }
    setMovieMapFn(movies);
    persistMovieCacheSnapshotFn({ movieMap: movies, env, consoleRef });
    movieCatalogCacheState.lastRefreshAt = new Date().toISOString();
    movieCatalogCacheState.lastRefreshSucceeded = true;
    movieCatalogCacheState.lastRefreshError = "";
    return true;
  } catch (error) {
    consoleRef.warn(`Movie cache refresh failed: ${error.message}`);
    movieCatalogCacheState.lastRefreshSucceeded = false;
    movieCatalogCacheState.lastRefreshError = String(error?.message || error);
    return false;
  } finally {
    movieCatalogCacheState.lastRefreshDurationMs = Date.now() - startedAt;
  }
}

export async function initializeMovieCatalogCache({
  appConfig,
  env = process.env,
  loadMovieCacheFromSnapshotFn = loadMovieCacheFromSnapshot,
  refreshMovieCatalogCacheFn = refreshMovieCatalogCache,
  consoleRef = console,
  getMovieMapFn = getMovieMap,
} = {}) {
  const loadedSnapshot = loadMovieCacheFromSnapshotFn({ env, consoleRef });
  const refreshed = refreshMovieCatalogCacheFn({
    appConfig,
    env,
    reason: "startup",
    consoleRef,
  });
  if (loadedSnapshot || refreshed) {
    const itemCount = getMovieMapFn().allIds.length;
    logD(`movie cache initialized with ${itemCount} items`);
  }
}

export function scheduleMovieCatalogRefresh({
  appConfig,
  env = process.env,
  refreshMovieCatalogCacheFn = refreshMovieCatalogCache,
  consoleRef = console,
} = {}) {
  const intervalCandidate = Number(env.VIDEO_CACHE_REFRESH_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(intervalCandidate) && intervalCandidate > 0
      ? intervalCandidate
      : DEFAULT_REFRESH_INTERVAL_MS;
  movieCatalogCacheState.refreshIntervalMs = intervalMs;
  movieCatalogCacheState.nextScheduledRefreshAt = new Date(
    Date.now() + intervalMs
  ).toISOString();
  const timer = setInterval(() => {
    refreshMovieCatalogCacheFn({
      appConfig,
      env,
      reason: "background",
      consoleRef,
    });
    movieCatalogCacheState.nextScheduledRefreshAt = new Date(
      Date.now() + intervalMs
    ).toISOString();
  }, intervalMs);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}
