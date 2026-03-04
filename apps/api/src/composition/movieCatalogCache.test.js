import {
  getMovieCatalogCacheStatus,
  loadMovieCacheFromSnapshot,
  persistMovieCacheSnapshot,
  refreshMovieCatalogCache,
  scheduleMovieCatalogRefresh,
} from "./movieCatalogCache";

describe("movieCatalogCache composition", () => {
  it("loads movie cache snapshot when valid", () => {
    const setMovieMapFn = jest.fn();
    const fsRef = {
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() =>
        JSON.stringify({ byId: { a: { id: "a" } }, allIds: ["a"] })
      ),
    };

    const loaded = loadMovieCacheFromSnapshot({
      env: { VIDEO_CACHE_SNAPSHOT_FILE: "/tmp/videos-cache.json" },
      fsRef,
      setMovieMapFn,
      consoleRef: { warn: jest.fn() },
    });

    expect(loaded).toBe(true);
    expect(setMovieMapFn).toHaveBeenCalledWith({
      byId: { a: { id: "a" } },
      allIds: ["a"],
    });
  });

  it("persists movie cache snapshot to disk", () => {
    const writes = [];
    const fsRef = {
      existsSync: jest.fn(() => false),
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn((file, content) => {
        writes.push({ file, content });
      }),
    };

    const result = persistMovieCacheSnapshot({
      movieMap: { byId: { a: { id: "a" } }, allIds: ["a"] },
      env: { VIDEO_CACHE_SNAPSHOT_FILE: "/tmp/videos-cache.json" },
      fsRef,
      consoleRef: { warn: jest.fn() },
    });

    expect(result).toBe(true);
    expect(fsRef.mkdirSync).toHaveBeenCalled();
    expect(writes.length).toBe(1);
  });

  it("keeps current cache when refresh finds zero movies", () => {
    const setMovieMapFn = jest.fn();
    const persisted = jest.fn();

    const refreshed = refreshMovieCatalogCache({
      appConfig: { videosPath: "/videos", moviesDir: "Movies" },
      fileServiceRef: {
        getVideos: jest.fn(() => ({ byId: {}, allIds: [] })),
      },
      getMovieMapFn: () => ({
        byId: { existing: { id: "existing" } },
        allIds: ["existing"],
      }),
      setMovieMapFn,
      persistMovieCacheSnapshotFn: persisted,
      consoleRef: { warn: jest.fn() },
    });

    expect(refreshed).toBe(false);
    expect(setMovieMapFn).not.toHaveBeenCalled();
    expect(persisted).not.toHaveBeenCalled();
  });

  it("schedules background refresh with provided interval", () => {
    jest.useFakeTimers();
    const refreshMovieCatalogCacheFn = jest.fn();
    const timer = scheduleMovieCatalogRefresh({
      appConfig: { videosPath: "/videos", moviesDir: "Movies" },
      env: { VIDEO_CACHE_REFRESH_INTERVAL_MS: "1000" },
      refreshMovieCatalogCacheFn,
      consoleRef: { warn: jest.fn() },
    });

    jest.advanceTimersByTime(1000);
    expect(refreshMovieCatalogCacheFn).toHaveBeenCalledTimes(1);

    clearInterval(timer);
    jest.useRealTimers();
  });

  it("returns cache status with item count", () => {
    const status = getMovieCatalogCacheStatus({
      env: { VIDEO_CACHE_SNAPSHOT_FILE: "/tmp/videos-cache.json" },
      getMovieMapFn: () => ({ byId: {}, allIds: ["a", "b"] }),
    });

    expect(status.snapshotFile).toBe("/tmp/videos-cache.json");
    expect(status.itemCount).toBe(2);
  });
});
