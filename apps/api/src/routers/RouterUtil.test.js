jest.mock("../config", () => {
  return () => ({
    imgFolderFallBack: "/fallback",
    videosPath: "/videos",
  });
});

jest.mock("../domain/fileUseCases", () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(),
  },
}));

jest.mock("../common/MessageUtil", () => ({
  logD: jest.fn(),
}));

describe("RouterUtil.imgProvider", () => {
  let imgProvider;
  let readFile;

  beforeEach(() => {
    process.env.PWD = "/app";
    jest.resetModules();
    ({ imgProvider } = require("./RouterUtil"));
    ({ default: { readFile } } = require("../domain/fileUseCases"));
    readFile.mockReset();
  });

  it("returns the image when found", () => {
    const imgBuffer = Buffer.from("img");
    readFile.mockReturnValueOnce(imgBuffer);

    const result = imgProvider({
      id: "movie1",
      name: "poster.jpg",
      img: "poster.jpg",
      folder: "Movies",
    });

    expect(result).toBe(imgBuffer);
    expect(readFile).toHaveBeenCalledWith({
      absolutePath: "/videos/Movies/movie1/poster.jpg",
      encoding: "none",
      logError: false,
    });
  });

  it("falls back to public image when not found", () => {
    const fallbackBuffer = Buffer.from("fallback");
    readFile.mockReturnValueOnce(undefined).mockReturnValueOnce(fallbackBuffer);

    const result = imgProvider({
      id: "movie2",
      name: "poster.jpg",
      img: "poster.jpg",
      folder: "Movies",
    });

    expect(result).toBe(fallbackBuffer);
    expect(readFile).toHaveBeenNthCalledWith(1, {
      absolutePath: "/videos/Movies/movie2/poster.jpg",
      encoding: "none",
      logError: false,
    });
    expect(readFile).toHaveBeenNthCalledWith(2, {
      absolutePath: "/app/public/movie_fallback.png",
      encoding: "none",
    });
  });

  it("uses fallback image folder when IMG_FALLBACK is requested", () => {
    const imgBuffer = Buffer.from("img");
    readFile.mockReturnValueOnce(imgBuffer);

    const result = imgProvider({
      id: "movie3",
      name: "movie_fallback.png",
      img: "movie_fallback.png",
      folder: "Movies",
    });

    expect(result).toBe(imgBuffer);
    expect(readFile).toHaveBeenCalledWith({
      absolutePath: "/fallback/movie3/movie_fallback.jpg",
      encoding: "none",
      logError: false,
    });
  });
});
