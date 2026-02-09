import {
  verifyingOrphanFiles,
  getFilesFolder,
  filterValidFiles,
  getFolderName,
  isThereVideoFile,
} from "./FileHelperUseCase";
import { mapMedia } from "./MediaMapper";
import { logD, logE } from "../../common/MessageUtil";
import { DEFAULT_ENCODING } from "../../common/AppServerConstant";

export default function FileUseCase({ FileApi }) {
  const { readDirectory, isDirExist, fileExtEqual, readFile, readFileInfo } =
    FileApi;
  const loadFiles = (folderName, baseLocation) =>
    getFilesFolder(`${baseLocation}/${folderName}`, readDirectory);
  const getValidFileList = (folderName, baseLocation) => {
    // video, subtitles, img
    return filterValidFiles(loadFiles(folderName, baseLocation), fileExtEqual);
  };
  return {
    getFileDirInfo: function (fullPath) {
      try {
        return FileApi.readFileInfo(fullPath);
      } catch (error) {
        logE(`Unable to read file information ${fullPath}: `);
        throw error;
      }
    },
    readFile({ absolutePath, encoding = DEFAULT_ENCODING, logError = true }) {
      try {
        return readFile(absolutePath, encoding);
      } catch (err) {
        logD(`Unable to read file ${absolutePath}: `, logError ? err : "");
      }
    },
    getSeries: function ({ baseLocation }) {
      logD(`getSeries under === ${baseLocation} ===`);
      const allFolders = getFolderName(baseLocation, {
        readDirectory,
      });
      return allFolders.reduce(
        (prev, folderName) => {
          const files = getValidFileList(folderName, baseLocation);
          const media = mapMedia({
            files,
            folderName,
            fileExtEqual,
            isFolder: true,
          });
          media.fileIds = loadFiles(folderName, baseLocation).filter((file) =>
            readFileInfo(
              baseLocation + "/" + folderName + "/" + file
            ).isDirectory()
          );
          prev.byId[folderName] = media;
          prev.allIds.push(folderName);
          return prev;
        },
        { byId: {}, allIds: [] }
      );
    },
    getVideo: function ({ baseLocation, folderName }) {
      //TODO validate folderName
      const parentFolder = folderName.split("__")[0];
      const childFolder = folderName.split("__")[1];
      const files = loadFiles(`${parentFolder}/${childFolder}`, baseLocation);
      const media = mapMedia({ files, folderName: childFolder, fileExtEqual });
      media.parentId = parentFolder;
      return media;
    },
    //TODO need test for this one
    getVideos: function ({ baseLocation }) {
      //It just goes 1 level in the folder
      if (isDirExist(baseLocation)) {
        logD(`getVideos under *** ${baseLocation} ***`);
        verifyingOrphanFiles(baseLocation, { readDirectory, fileExtEqual });
        // get all folders including the ones that does not have video
        const allFolders = getFolderName(baseLocation, { readDirectory });

        const onlyFolderWithValidFiles = (folderName) =>
          getValidFileList(folderName, baseLocation).length > 0;
        // reuse getValidFileList for the files in the folder
        const isThereAVideoInFolder = (folderName) =>
          getValidFileList(folderName, baseLocation).filter((fileName) =>
            isThereVideoFile(fileName, fileExtEqual)
          ).length > 0;
        const buildUpFoldersTable = (prev, folderName) => {
          const files = loadFiles(folderName, baseLocation);
          const media = mapMedia({ files, folderName, fileExtEqual });
          prev.byId[folderName] = media;
          prev.allIds.push(media.id);
          return prev;
        };
        return allFolders
          .filter(onlyFolderWithValidFiles)
          .filter(isThereAVideoInFolder)
          .reduce(buildUpFoldersTable, { byId: {}, allIds: [] });
      } else {
        return { byId: {}, allIds: [] };
      }
    },
    getFileExt(fileName) {
      return fileExtEqual(fileName);
    },
  };
}
