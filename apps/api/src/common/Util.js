let MovieMap = { byId: {}, allIds: [] };
let seriesMap = { byId: {}, allIds: [] };

export function setMovieMap(map) {
  MovieMap = map;
}

export function getMovieMap() {
  return MovieMap;
}

export function setSeriesMap(map) {
  seriesMap = map;
}

export function getSeriesMap() {
  return seriesMap;
}

export function requiredParameter(name, isThrow = true) {
  //TODO add log monitoring
  if (isThrow) {
    throw new Error(`${name} is required`);
  } else {
    console.error(`${name} is required *`);
  }
}

export function removeSpecialCharacters(inputString) {
  if (!inputString) {
    return "";
  }
  return inputString.replace(/[^a-zA-Z0-9]/g, "");
}

export function getImageUrl(folderName, MOVIE_MAP, IMAGE_SERVER_URL) {
  const rawFolderName = removeSpecialCharacters(folderName).toLowerCase();
  const obgImg = MOVIE_MAP[rawFolderName];
  if (!obgImg) {
    return "";
  }
  const { folder, imgName } = obgImg;
  return `${IMAGE_SERVER_URL}/${folder}/${imgName}`;
}

export function printMemoryUsage() {
  console.log("NODE_OPT", process.env.NODE_OPTIONS);

  const memoryUsage = process.memoryUsage();
  const totalHeapSize = memoryUsage.heapTotal;
  const totalHeapSizeMB = (totalHeapSize / 1024 / 1024).toFixed(2);

  console.log(`Total Heap Size: ${totalHeapSizeMB} MB`);
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const trimmed = part.trim();
    if (!trimmed) return acc;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) return acc;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

export function getCookie(req, name) {
  const cookieHeader = req.headers?.cookie || "";
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}
