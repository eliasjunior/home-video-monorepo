export function createEmptyTable() {
  return { byId: {}, allIds: [] };
}

export function deriveMediaId(videoName, fileExtEqual) {
  const fileExt = fileExtEqual(videoName);
  return videoName.slice(0, videoName.length - fileExt.length);
}

export function assertNoIdCollision({ id, baseLocation, existingById }) {
  if (existingById[id]) {
    throw new Error(
      `Media id collision for '${id}': both folder-based and flat files exist under ${baseLocation}.`
    );
  }
}

export function listFolderMedia({
  baseLocation,
  getFolderName,
  readDirectory,
  getValidFileList,
  isThereVideoFile,
  fileExtEqual,
  loadFiles,
  mapMedia,
} = {}) {
  const allFolders = getFolderName(baseLocation, { readDirectory });
  const validFilesByFolder = allFolders.reduce((acc, folderName) => {
    acc[folderName] = getValidFileList(folderName, baseLocation);
    return acc;
  }, {});
  const hasValidFiles = (folderName) => validFilesByFolder[folderName].length > 0;
  const hasVideoInFolder = (folderName) =>
    validFilesByFolder[folderName].some((fileName) =>
      isThereVideoFile(fileName, fileExtEqual)
    );
  const buildFolderTable = (prev, folderName) => {
    const files = loadFiles(folderName, baseLocation);
    const media = mapMedia({ files, folderName, fileExtEqual });
    prev.byId[folderName] = media;
    prev.allIds.push(media.id);
    return prev;
  };

  return allFolders
    .filter(hasValidFiles)
    .filter(hasVideoInFolder)
    .reduce(buildFolderTable, createEmptyTable());
}

export function listFlatMedia({
  baseLocation,
  readDirectory,
  filterValidFiles,
  fileExtEqual,
  isThereVideoFile,
  mapMedia,
  existingById,
} = {}) {
  const topLevelFiles = readDirectory(baseLocation)
    .filter((item) => !item.isDirectory())
    .map((item) => item.name);
  const validTopLevelFiles = filterValidFiles(topLevelFiles, fileExtEqual);
  const topLevelVideoFiles = validTopLevelFiles.filter((fileName) =>
    isThereVideoFile(fileName, fileExtEqual)
  );

  return topLevelVideoFiles.reduce((flatTable, videoName) => {
    const id = deriveMediaId(videoName, fileExtEqual);
    assertNoIdCollision({ id, baseLocation, existingById });
    const siblingFiles = validTopLevelFiles.filter((fileName) =>
      fileName.startsWith(`${id}.`)
    );
    const media = mapMedia({
      files: siblingFiles,
      folderName: id,
      fileExtEqual,
    });
    media.isFlat = true;
    flatTable.byId[id] = media;
    flatTable.allIds.push(id);
    return flatTable;
  }, createEmptyTable());
}

export function mergeMediaTables(folderTable, flatTable) {
  return {
    byId: {
      ...folderTable.byId,
      ...flatTable.byId,
    },
    allIds: [...folderTable.allIds, ...flatTable.allIds],
  };
}

