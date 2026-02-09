import {
  VIDEO_FORMATS,
  SUB_FORMATS,
  IMG_FORMATS,
} from "../../common/AppServerConstant";

export function filterValidFiles(fileList, fileExtEqual) {
  const isValidExtension = (fileName) => {
    return (
      isThereVideoFile(fileName, fileExtEqual) ||
      SUB_FORMATS.filter((ext) => ext === fileExtEqual(fileName)).length > 0 ||
      IMG_FORMATS.filter((ext) => ext === fileExtEqual(fileName)).length > 0
    );
  };
  return fileList.filter((fileName) => isValidExtension(fileName));
}

export function isThereVideoFile(fileName, fileExtEqual) {
  return (
    VIDEO_FORMATS.filter((ext) => ext === fileExtEqual(fileName)).length > 0
  );
}
export function getFolderName(baseLocation, { readDirectory }) {
  const fileOrFolder = readDirectory(baseLocation);
  return fileOrFolder
    .filter((file) => file.isDirectory())
    .map((file) => file.name);
}
export function verifyingOrphanFiles(
  baseLocation,
  { readDirectory, fileExtEqual }
) {
  const justFiles = readDirectory(baseLocation)
    .filter((file) => !file.isDirectory())
    .map((file) => file.name);

  if (justFiles.length > 0) {
    filterValidFiles(justFiles, fileExtEqual).forEach((name) => {
      console.warn(`*** ${name} does not has a parent folder`);
    });
  } else {
    console.info(`No files with video ext[${permittedVideoExtStr()}] or 
            sub ext[${permittedSubExtStr()}] without a parent in ${baseLocation}`);
  }
}
// only the file name, not the object file
export function getFilesFolder(folderName, readDirectory) {
  try {
    const fileOrFolder = readDirectory(folderName);
    return fileOrFolder.map((file) => file.name);
  } catch (err) {
    console.error("Unable to scan directory: " + err);
    return [];
  }
}
function permittedVideoExtStr() {
  return VIDEO_FORMATS.reduce((prev, cur) => {
    prev = prev.concat(cur) + ", ";
    return prev;
  }, "");
}
function permittedSubExtStr() {
  return SUB_FORMATS.reduce((prev, cur) => {
    prev = prev.concat(cur) + ", ";
    return prev;
  }, "");
}
