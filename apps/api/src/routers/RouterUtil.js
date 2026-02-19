const FILE_EXT_INDEX = 4;
import config from "../config";
const { imgFolderFallBack, videosPath } = config();
import UtilFile from "../domain/fileUseCases";
const { readFile } = UtilFile;
import { logD } from "../common/MessageUtil";
const { PWD } = process.env;
import { IMG_FALLBACK } from "../common/AppServerConstant";

export function sendError({ response, statusCode, message, error = {} }) {
  response
    .status(statusCode)
    .send({
      message: message,
      error: error.message,
    })
    .end();
}

//TODO need ability to inject readFile
export function imgProvider({ id, name, img, folder, userVideosPath }) {
  const basePath = userVideosPath || videosPath;
  let binImg = readFile({
    absolutePath: getImgPath({ fileName: name, img, id, folder, basePath }),
    encoding: "none",
    logError: false,
  });

  if (binImg) {
    logD(`=== > img[${img}] found`);
    return binImg;
  } else {
    const fallbackFolder = `${PWD}/public/${IMG_FALLBACK}`;
    logD(`=== > img[${img}] not found trying to load fallback img`);
    // fallback img
    return readFile({ absolutePath: fallbackFolder, encoding: "none" });
  }
}

// private functions

function getImgPath({ fileName: name, id, img, folder, basePath }) {
  const path = basePath || videosPath;
  if (imgFolderFallBack && name.includes(IMG_FALLBACK)) {
    const imgTemp = name.slice(0, name.length - FILE_EXT_INDEX).concat(".jpg");
    return `${imgFolderFallBack}/${id}/${imgTemp}`;
  } else {
    return `${path}/${folder}/${id}/${img}`;
  }
}