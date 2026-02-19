import {
  verifyingOrphanFiles,
  getFilesFolder,
  filterValidFiles,
  getFolderName,
  isThereVideoFile,
} from "./FileHelperUseCase";
import { mapMedia } from "./MediaMapper";
import {
  createEmptyTable,
  listFolderMedia,
  listFlatMedia,
  mergeMediaTables,
} from "./MediaScanUtil";
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

  const parseSeriesFolderName = (folderName) => {
    const [parentFolder, childFolder] = String(folderName || "").split("__");
    if (!parentFolder || !childFolder) {
      throw new Error(
        "Invalid series folderName format. Expected '<parent>__<child>'.",
      );
    }
    return { parentFolder, childFolder };
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
              baseLocation + "/" + folderName + "/" + file,
            ).isDirectory(),
          );
          prev.byId[folderName] = media;
          prev.allIds.push(folderName);
          return prev;
        },
        { byId: {}, allIds: [] },
      );
    },
    getVideo: function ({ baseLocation, folderName }) {
      const { parentFolder, childFolder } = parseSeriesFolderName(folderName);
      const files = loadFiles(`${parentFolder}/${childFolder}`, baseLocation);
      const media = mapMedia({ files, folderName: childFolder, fileExtEqual });
      media.parentId = parentFolder;
      return media;
    },
    getVideos: function ({ baseLocation }) {
      //It just goes 1 level in the folder
      if (!isDirExist(baseLocation)) {
        return createEmptyTable();
      }
      logD(`getVideos under *** ${baseLocation} ***`);
      verifyingOrphanFiles(baseLocation, { readDirectory, fileExtEqual });

      const foldersTable = listFolderMedia({
        baseLocation,
        getFolderName,
        readDirectory,
        getValidFileList,
        isThereVideoFile,
        fileExtEqual,
        loadFiles,
        mapMedia,
      });
      const flatTable = listFlatMedia({
        baseLocation,
        readDirectory,
        filterValidFiles,
        fileExtEqual,
        isThereVideoFile,
        mapMedia,
        existingById: foldersTable.byId,
      });
      return mergeMediaTables(foldersTable, flatTable);
    },
    getFileExt(fileName) {
      return fileExtEqual(fileName);
    },
  };
}
