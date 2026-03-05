import express from "express";
import { logD, logE } from "../common/MessageUtil";
import DataAccess from "../domain/fileUseCases";
import StreamingData from "../domain/streamingUseCases";
import {
  SUCCESS_STATUS,
  PARTIAL_CONTENT_STATUS,
  config,
} from "../common/AppServerConstant";
import {
  getHeaderStream,
  streamEvents,
  getStartEndBytes,
} from "../domain/streamingUseCases/StreamingUtilUseCase";
import {
  setMovieMap,
  getMovieMap,
  setSeriesMap,
  getSeriesMap,
} from "../common/Util";
import { sendError } from "./RouterUtil";
import { getUserMoviesPath, getUserSeriesPath, getUserVideoPath } from "../user/userDirectory.js";

export function createVideosRouter({
  dataAccess = DataAccess,
  streamingData = StreamingData,
  appConfig = config,
} = {}) {
  const moviesAbsPath = `${appConfig.videosPath}/${appConfig.moviesDir}`;
  const seriesAbsPath = `${appConfig.videosPath}/${appConfig.seriesDir}`;
  const { createStream } = streamingData;
  const { getVideos, getFileDirInfo, getSeries, getVideo } = dataAccess;
  const router = express.Router();

  // Helper to get user-specific paths
  function getUserPaths(req) {
    const multiUserEnabled = process.env.MULTI_USER_ENABLED === "true";
    if (multiUserEnabled && req.user && req.user.username) {
      return {
        moviesPath: getUserMoviesPath(req.user.username),
        seriesPath: getUserSeriesPath(req.user.username),
        videosPath: getUserVideoPath(req.user.username),
      };
    }
    return {
      moviesPath: moviesAbsPath,
      seriesPath: seriesAbsPath,
      videosPath: appConfig.videosPath,
    };
  }

  router.get("/", redirectMovies);
  router.get("/videos", loadMovies);
  router.get("/videos/nextcloud/:fileId/stream", streamNextcloudVideo);  // Must be before generic routes
  router.get("/videos/:id", loadMovie);
  router.get("/videos/:folder/:fileName", streamingVideo);

  router.get("/series", loadSeries);
  router.get("/series/:id", loadShow);
  router.get("/series/:parent/:folder/:fileName", streamingShow);

  function redirectMovies(_, res) {
    res.redirect("/videos");
  }
  function loadMovies(req, response) {
    try {
      const { moviesPath, videosPath } = getUserPaths(req);
      const videos = getVideos({ baseLocation: moviesPath });

      logD("videosPath=", videosPath);
      logD("user=", req.user?.username);

      const tempMap = videos.allIds.reduce(
        (prev, id) => {
          prev.byId[id] = videos.byId[id];
          prev.allIds.push(id);
          return prev;
        },
        { byId: {}, allIds: [] }
      );
      setMovieMap(tempMap);

      flushJSON(response, videos);
    } catch (error) {
      sendError({
        response,
        message: "Attempt to load videos has failed",
        statusCode: 500,
        error,
      });
    }
  }
  function loadSeries(req, response) {
    try {
      const { seriesPath } = getUserPaths(req);
      const folders = getSeries({
        baseLocation: seriesPath,
      });
      const tempMap = folders.allIds.reduce(
        (prev, id) => {
          prev.byId[id] = folders.byId[id];
          prev.allIds.push(id);
          return prev;
        },
        { byId: {}, allIds: [] }
      );
      setSeriesMap(tempMap);
      flushJSON(response, folders);
    } catch (error) {
      sendError({
        response,
        message: "Attempt to load series has failed",
        statusCode: 500,
        error,
      });
    }
  }
  function loadMovie(req, response) {
    const { id, isSeries } = req.params;
    let movieMap = getMovieMap();
    const seriesMap = getSeriesMap();

    const sendLoadMovieError = () => {
      logE(`Attempting to get a video in memory id ${id} has failed`);
      sendError({
        response,
        message:
          "Something went wrong, file in memory resource not fully implemented or id does not exist",
        statusCode: 501,
      });
    };

    // Handle Nextcloud videos (ID format: nextcloud-{fileId})
    if (id && id.startsWith('nextcloud-')) {
      console.log(`[VIDEO] Nextcloud video requested: ${id}`);
      const fileId = id.replace('nextcloud-', '');

      // Return Nextcloud video metadata
      // The Player component will use this to construct the streaming URL
      flushJSON(response, {
        id: id,
        fileId: fileId,
        isNextcloudShare: true,
        nextcloudData: {
          fileId: fileId,
          // Player will get actual file details from sessionStorage
        },
        // Indicate that this is a Nextcloud video
        folder: "Nextcloud",
        name: `Video ${fileId}`
      });
      return;
    }

    if (movieMap.allIds.length === 0) {
      try {
        const { moviesPath } = getUserPaths(req);
        const videos = getVideos({ baseLocation: moviesPath });
        const tempMap = videos.allIds.reduce(
          (prev, id) => {
            prev.byId[id] = videos.byId[id];
            prev.allIds.push(id);
            return prev;
          },
          { byId: {}, allIds: [] }
        );
        setMovieMap(tempMap);
        movieMap = tempMap;
      } catch (error) {
        sendError({
          response,
          message: "Attempt to load videos has failed",
          statusCode: 500,
          error,
        });
        return;
      }
    }
    if (isSeries) {
      if (!seriesMap.byId[id]) {
        sendLoadMovieError();
      } else {
        flushJSON(response, movieMap.byId[id]);
      }
    } else if (!movieMap.byId[id]) {
      sendLoadMovieError();
    } else {
      flushJSON(response, movieMap.byId[id]);
    }
  }
  function loadShow(req, response) {
    const { id } = req.params;
    const { seriesPath } = getUserPaths(req);
    const show = getVideo({ baseLocation: seriesPath, folderName: id });

    if (!show) {
      logE(`Attempting to get a video in memory id ${id} has failed`);
      sendError({
        response,
        message:
          "Something went wrong, file in memory resource not fully implemented or id does not exist",
        statusCode: 501,
      });
    } else {
      flushJSON(response, show);
    }
  }
  function streamingVideo(request, response) {
    const { folder, fileName } = request.params;
    const { moviesPath } = getUserPaths(request);
    const movieMap = getMovieMap();
    const media = movieMap.byId[folder];
    const fileAbsPath =
      media && media.isFlat
        ? `${moviesPath}/${fileName}`
        : `${moviesPath}/${folder}/${fileName}`;

    // Security: Verify the file path is within the user's movies directory
    const path = require('path');
    const resolvedPath = path.resolve(fileAbsPath);
    const resolvedMoviesPath = path.resolve(moviesPath);

    if (!resolvedPath.startsWith(resolvedMoviesPath)) {
      logE(`Access denied: User attempted to access file outside their directory: ${resolvedPath}`);
      return sendError({
        response,
        message: "Access denied",
        statusCode: 403,
      });
    }

    doStreaming({ request, response, fileAbsPath });
  }

  function streamingShow(request, response) {
    const { folder, fileName, parent } = request.params;
    const { seriesPath } = getUserPaths(request);
    const fileAbsPath = `${seriesPath}/${parent}/${folder}/${fileName}`;

    // Security: Verify the file path is within the user's series directory
    const path = require('path');
    const resolvedPath = path.resolve(fileAbsPath);
    const resolvedSeriesPath = path.resolve(seriesPath);

    if (!resolvedPath.startsWith(resolvedSeriesPath)) {
      logE(`Access denied: User attempted to access file outside their directory: ${resolvedPath}`);
      return sendError({
        response,
        message: "Access denied",
        statusCode: 403,
      });
    }

    doStreaming({ request, response, fileAbsPath });
  }

  function doStreaming({ fileAbsPath, request, response }) {
    const { range } = request.headers;
    try {
      const statInfo = getFileDirInfo(fileAbsPath);
      const { size } = statInfo;
      if (range) {
        const { start, end } = getStartEndBytes(range, size);
        const headers = getHeaderStream({ start, end, size });
        response.writeHead(PARTIAL_CONTENT_STATUS, headers);

        const readStream = createStream({
          fileAbsPath,
          start,
          end,
        });

        streamEvents({
          readStream,
          useCaseLabel: "video",
          outputWriter: response,
        });
      } else {
        logE(`NO RANGE ${fileAbsPath}. Streaming full file.`);
        response.writeHead(SUCCESS_STATUS, {
          "Accept-Ranges": "bytes",
          "Content-Length": size,
          "Content-Type": "video/mp4",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        });
        const readStream = createStream({ fileAbsPath });
        streamEvents({
          readStream,
          useCaseLabel: "video",
          outputWriter: response,
        });
      }
    } catch (error) {
      logE(`Attempting to stream file path ${fileAbsPath} has failed`, error);
      sendError({
        response,
        message:
          "Something went wrong, file not found, maybe folder has a different name",
        statusCode: 500,
        error,
      });
    }
  }

  async function streamNextcloudVideo(req, response) {
    const { fileId } = req.params;
    console.log(`[NEXTCLOUD_STREAM] Streaming file ID: ${fileId}`);

    try {
      // Get Nextcloud credentials from request body or query
      const username = req.query.username || req.body?.username;
      const appPassword = req.query.appPassword || req.body?.appPassword;
      const filePath = req.query.filePath || req.body?.filePath;

      if (!username || !appPassword || !filePath) {
        return sendError({
          response,
          message: "Missing Nextcloud credentials or file path",
          statusCode: 400,
        });
      }

      const nextcloudUrl = process.env.NEXTCLOUD_URL || 'https://spendingbetter.com/nextcloud';
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const webdavUrl = `${nextcloudUrl}/remote.php/dav/files/${username}${encodedPath}`;

      console.log(`[NEXTCLOUD_STREAM] Fetching from: ${webdavUrl}`);

      // Create Basic Auth header
      const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

      // Forward range header if present
      const headers = {
        'Authorization': `Basic ${auth}`,
      };

      const hasRangeRequest = !!req.headers.range;
      if (hasRangeRequest) {
        console.log(`[NEXTCLOUD_STREAM] Range request: ${req.headers.range}`);
        headers['Range'] = req.headers.range;
      } else {
        console.log(`[NEXTCLOUD_STREAM] No Range header in request`);
      }

      // Fetch from Nextcloud
      const fetch = (await import('node-fetch')).default;
      const ncResponse = await fetch(webdavUrl, { headers });

      console.log(`[NEXTCLOUD_STREAM] Nextcloud response status: ${ncResponse.status}`);

      if (!ncResponse.ok && ncResponse.status !== 206) {
        console.error(`[NEXTCLOUD_STREAM] Nextcloud returned ${ncResponse.status}`);
        return sendError({
          response,
          message: "Failed to fetch video from Nextcloud",
          statusCode: ncResponse.status,
        });
      }

      // Forward headers - preserve status code (200 or 206)
      response.status(ncResponse.status);
      response.set('Content-Type', ncResponse.headers.get('content-type') || 'video/mp4');

      // Always set Accept-Ranges to advertise support
      response.set('Accept-Ranges', 'bytes');

      // Cache control headers to prevent browser from caching full responses
      response.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.set('Pragma', 'no-cache');
      response.set('Expires', '0');

      if (ncResponse.headers.get('content-length')) {
        response.set('Content-Length', ncResponse.headers.get('content-length'));
      }

      if (ncResponse.headers.get('content-range')) {
        console.log(`[NEXTCLOUD_STREAM] Content-Range: ${ncResponse.headers.get('content-range')}`);
        response.set('Content-Range', ncResponse.headers.get('content-range'));
      }

      // Pipe the response
      ncResponse.body.pipe(response);
    } catch (error) {
      console.error(`[NEXTCLOUD_STREAM] Error:`, error);
      sendError({
        response,
        message: "Error streaming Nextcloud video",
        statusCode: 500,
        error,
      });
    }
  }

  function flushJSON(response, videos) {
    response.status(SUCCESS_STATUS).json(videos).end();
  }

  return router;
}

export default createVideosRouter();
