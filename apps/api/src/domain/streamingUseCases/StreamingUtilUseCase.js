const { logD } = require("../../common/MessageUtil");
import {
  BASE_STREAM_CALC,
  EXPONENT,
  INTERNAL_SERVER_ERROR,
  SUCCESS_STATUS,
} from "../../common/AppServerConstant";
import { requiredParameter } from "../../common/Util";

export function streamEvents({
  readStream = requiredParameter("stream"),
  useCaseLabel,
  outputWriter = requiredParameter("outputWriter"),
}) {
  readStream.on("open", () => {
    logD(`Stream ${useCaseLabel} opened `);
  });
  readStream.on("data", (chunk) => {
    outputWriter.write(chunk);
  });
  readStream.on("end", () => {
    logD(`Stream ${useCaseLabel} ended.`);
    outputWriter.status(SUCCESS_STATUS).send().end();
  });
  readStream.on("error", (error) => {
    console.error(`Stream ${useCaseLabel} ERR! ====`, error);
    outputWriter.status(INTERNAL_SERVER_ERROR).send().end();
  });
  // streamChunk.pipe(outputWriter); its failing in local
}
export function getHeaderStream({ start, end, size }) {
  const chunkSize = end - start + 1;
  logD(`chunkSize ${chunkSize}`);
  return {
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4",
  };
}
export function getStartEndBytes(initialRange, size) {
  const chunkSize = Math.pow(BASE_STREAM_CALC, EXPONENT); // 5MB
  const start = Number(initialRange.replace(/\D/g, ""));
  const end = Math.min(start + chunkSize, size - 1);

  // TODO add this to ENV
  logD(`size ${size}`);
  logD(`range ${initialRange}`);
  logD(`start ${start}`);
  logD(`end ${end}`);
  return { start, end };
}
