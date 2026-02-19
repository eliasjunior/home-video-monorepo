import {
  fetchAndLogJsonData,
  initializeImageMap,
  startServer,
} from "./startup";

describe("startup composition", () => {
  it("returns remote json data on success", async () => {
    const loadRemoteJsonFileFn = jest.fn(async () => ({ a: 1 }));

    const result = await fetchAndLogJsonData({
      remoteJsonUrl: "http://example.test/map.json",
      loadRemoteJsonFileFn,
      env: { NODE_ENV: "development" },
      consoleRef: { warn: jest.fn(), error: jest.fn() },
    });

    expect(result).toEqual({ a: 1 });
  });

  it("sets movie map when image map is enabled", async () => {
    const setMoviesMapFn = jest.fn();
    const fetchAndLogJsonDataFn = jest.fn(async () => ({ map: true }));
    const logDebug = jest.fn();

    await initializeImageMap({
      appConfig: {
        imageMapEnabled: "true",
        protocol: "http",
        imageServerHost: "host",
        imagePort: "80",
        imageMapFileName: "movie_map.json",
      },
      setMoviesMapFn,
      fetchAndLogJsonDataFn,
      logDebug,
      env: { NODE_ENV: "development" },
      consoleRef: { warn: jest.fn(), error: jest.fn() },
    });

    expect(fetchAndLogJsonDataFn).toHaveBeenCalled();
    expect(setMoviesMapFn).toHaveBeenCalledWith({ map: true });
  });

  it("sets empty movie map when image map is disabled", async () => {
    const setMoviesMapFn = jest.fn();
    const fetchAndLogJsonDataFn = jest.fn();

    await initializeImageMap({
      appConfig: { imageMapEnabled: "false" },
      setMoviesMapFn,
      fetchAndLogJsonDataFn,
      logDebug: jest.fn(),
    });

    expect(fetchAndLogJsonDataFn).not.toHaveBeenCalled();
    expect(setMoviesMapFn).toHaveBeenCalledWith({});
  });

  it("skips app.listen in test environment", () => {
    const app = { listen: jest.fn() };

    const result = startServer({
      app,
      appConfig: { port: 8080 },
      env: { NODE_ENV: "test" },
    });

    expect(result).toBeNull();
    expect(app.listen).not.toHaveBeenCalled();
  });
});

