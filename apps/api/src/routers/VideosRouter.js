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

  router.get("/", redirectMovies);
  router.get("/videos", loadMovies);
  router.get("/videos/:id", loadMovie);
  router.get("/videos/:folder/:fileName", streamingVideo);

  router.get("/series", loadSeries);
  router.get("/series/:id", loadShow);
  router.get("/series/:parent/:folder/:fileName", streamingShow);

  function redirectMovies(_, res) {
    res.redirect("/videos");
  }
  function loadMovies(_, response) {
    try {
      const videos = getVideos({ baseLocation: `${moviesAbsPath}` });

      logD("videosPath=", appConfig.videosPath);
      if (videos.allIds.length === 0) {
        sendError({
          response,
          message: `No videos were found. Expected movies under ${appConfig.videosPath}/${appConfig.moviesDir}/<MovieFolder>/<videoFile>.`,
          statusCode: 500,
        });
      } else {
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
      }
    } catch (error) {
      sendError({
        response,
        message: "Attempt to load videos has failed",
        statusCode: 500,
        error,
      });
    }
  }
  function loadSeries(_, response) {
    try {
      const folders = getSeries({
        baseLocation: `${appConfig.videosPath}/${appConfig.seriesDir}`,
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

    if (movieMap.allIds.length === 0) {
      try {
        const videos = getVideos({ baseLocation: `${moviesAbsPath}` });
        if (videos.allIds.length === 0) {
          sendError({
            response,
            message: `No videos were found. Expected movies under ${appConfig.videosPath}/${appConfig.moviesDir}/<MovieFolder>/<videoFile>.`,
            statusCode: 500,
          });
          return;
        }
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
    const show = getVideo({ baseLocation: seriesAbsPath, folderName: id });

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
    const movieMap = getMovieMap();
    const media = movieMap.byId[folder];
    const fileAbsPath =
      media && media.isFlat
        ? `${moviesAbsPath}/${fileName}`
        : `${moviesAbsPath}/${folder}/${fileName}`;
    doStreaming({ request, response, fileAbsPath });
  }

  function streamingShow(request, response) {
    const { folder, fileName, parent } = request.params;
    const fileAbsPath = `${seriesAbsPath}/${parent}/${folder}/${fileName}`;
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

  function flushJSON(response, videos) {
    response.status(SUCCESS_STATUS).json(videos).end();
  }

  return router;
}

export default createVideosRouter();
