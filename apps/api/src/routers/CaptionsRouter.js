import express from "express";
import { logE } from "../common/MessageUtil";
import config from "../config";
import fileUseCases from "../domain/fileUseCases";
import streamingUseCases from "../domain/streamingUseCases";
import { streamEvents } from "../domain/streamingUseCases/StreamingUtilUseCase";
import subsrt from "subsrt";
import { sendError } from "./RouterUtil";

export function createCaptionsRouter({
  appConfig = config(),
  fileService = fileUseCases,
  streamService = streamingUseCases,
} = {}) {
  const router = express.Router();
  const { videosPath, moviesDir, seriesDir } = appConfig;
  const moviesAbsPath = `${videosPath}/${moviesDir}`;
  const seriesAbsPath = `${videosPath}/${seriesDir}`;
  const { getFileExt, readFile } = fileService;
  const { createStream } = streamService;

  router.get("/captions/:folder/:fileName", getCaption);
  router.get("/captions/:parent/:folder/:fileName", getCaptionShow);

  function getCaption(request, response) {
    const { folder, fileName } = request.params;
    const fileAbsPath = `${moviesAbsPath}/${folder}/${fileName}`;
    doCaption({ request, response, fileAbsPath });
  }

  function getCaptionShow(request, response) {
    const { folder, fileName, parent } = request.params;
    const fileAbsPath = `${seriesAbsPath}/${parent}/${folder}/${fileName}`;
    doCaption({ request, response, fileAbsPath });
  }

  function doCaption({ request, response, fileAbsPath }) {
    const { fileName } = request.params;
    try {
      const ext = getFileExt(fileName);
      if (ext === ".vtt") {
        response.setHeader("content-type", "vtt");

        const readStream = createStream({ fileAbsPath });
        streamEvents({
          readStream,
          useCaseLabel: "caption",
          outputWriter: response,
        });
      } else {
        const srtContent = readFile({ absolutePath: fileAbsPath });
        const srt = subsrt.convert(srtContent, { format: "vtt", fps: 25 });
        response.send(srt);
      }
    } catch (error) {
      logE(
        `Attempting to play subtitles file path ${fileName} has failed`,
        error
      );
      sendError({
        response,
        message: "Something went wrong, file not found",
        statusCode: 500,
        error,
      });
    }
  }

  return router;
}

export default createCaptionsRouter();
