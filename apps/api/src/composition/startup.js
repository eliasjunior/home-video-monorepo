import { logD } from "../common/MessageUtil";
import { loadRemoteJsonFile } from "../libs/HttpLib";
import { setMoviesMap } from "../libs/MemoryLib";

export async function fetchAndLogJsonData({
  remoteJsonUrl,
  env = process.env,
  loadRemoteJsonFileFn = loadRemoteJsonFile,
  consoleRef = console,
} = {}) {
  try {
    return await loadRemoteJsonFileFn(remoteJsonUrl);
  } catch (error) {
    if (env.NODE_ENV === "production") {
      consoleRef.error(
        `error to retrieve json map in ${remoteJsonUrl} \n ${error.message}`
      );
    } else {
      consoleRef.warn(
        `Image map unavailable at ${remoteJsonUrl}. Using empty map (dev).`
      );
    }
    return {};
  }
}

export async function initializeImageMap({
  appConfig,
  env = process.env,
  logDebug = logD,
  setMoviesMapFn = setMoviesMap,
  fetchAndLogJsonDataFn = fetchAndLogJsonData,
  consoleRef = console,
} = {}) {
  const imageMapEnabled =
    String(appConfig.imageMapEnabled || "").toLowerCase() === "true";

  if (imageMapEnabled) {
    const jsonUrl = `${appConfig.protocol}://${appConfig.imageServerHost}:${appConfig.imagePort}/json/${appConfig.imageMapFileName}`;
    logDebug("jsonUrl=>", jsonUrl);
    const moviesMap = await fetchAndLogJsonDataFn({
      remoteJsonUrl: jsonUrl,
      env,
      consoleRef,
    });
    logDebug("moviesMap=", moviesMap);
    setMoviesMapFn(moviesMap || {});
    return;
  }

  logDebug("image map disabled via IMAGE_MAP_ENABLED");
  setMoviesMapFn({});
}

export function startServer({
  app,
  appConfig,
  env = process.env,
  consoleRef = console,
  initializeImageMapFn = initializeImageMap,
} = {}) {
  if (env.NODE_ENV === "test") {
    return null;
  }

  return app.listen(appConfig.port, async () => {
    consoleRef.log(`Application started, ${appConfig.serverUrl}`);
    consoleRef.log("App config");
    consoleRef.log(`Movies folder: ${appConfig.moviesDir}`);
    consoleRef.log(`baseLocation: ${appConfig.baseLocation}`);
    await initializeImageMapFn({ appConfig, env, consoleRef });
  });
}

