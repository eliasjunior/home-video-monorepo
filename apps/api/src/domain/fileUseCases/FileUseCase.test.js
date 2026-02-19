import fs from "fs";
import os from "os";
import path from "path";
import FileUseCase from "./FileUseCase";
import FileLib from "../../libs/FileLib";
import { logD, logE } from "../../common/MessageUtil";

jest.mock("../../common/MessageUtil", () => ({
  logD: jest.fn(),
  logE: jest.fn(),
}));

describe("FileUseCase (integration-lite)", () => {
  let baseDir;
  let fileUseCase;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-video-"));
    fileUseCase = FileUseCase({ FileApi: FileLib() });
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns empty map when baseLocation does not exist", () => {
    const result = fileUseCase.getVideos({
      baseLocation: path.join(baseDir, "missing"),
    });

    expect(result).toEqual({ byId: {}, allIds: [] });
  });

  it("returns only folders containing video files", () => {
    const moviesDir = path.join(baseDir, "Movies");
    fs.mkdirSync(moviesDir, { recursive: true });

    const goodFolder = path.join(moviesDir, "MovieA");
    const badFolder = path.join(moviesDir, "SubOnly");
    fs.mkdirSync(goodFolder, { recursive: true });
    fs.mkdirSync(badFolder, { recursive: true });

    fs.writeFileSync(path.join(goodFolder, "MovieA.mp4"), "");
    fs.writeFileSync(path.join(goodFolder, "MovieA.srt"), "");
    fs.writeFileSync(path.join(badFolder, "SubOnly.srt"), "");

    const result = fileUseCase.getVideos({ baseLocation: moviesDir });

    expect(result.allIds).toEqual(["MovieA"]);
    expect(result.byId.MovieA.name).toBe("MovieA.mp4");
  });

  it("returns videos when Movies contains flat files (no parent folder)", () => {
    const moviesDir = path.join(baseDir, "Movies");
    fs.mkdirSync(moviesDir, { recursive: true });
    fs.writeFileSync(path.join(moviesDir, "FlatMovie.mp4"), "");
    fs.writeFileSync(path.join(moviesDir, "FlatMovie.srt"), "");

    const result = fileUseCase.getVideos({ baseLocation: moviesDir });

    expect(result.allIds.length).toBe(1);
    const [id] = result.allIds;
    expect(result.byId[id].name).toBe("FlatMovie.mp4");
  });

  it("throws when flat movie id collides with folder-based movie id", () => {
    const moviesDir = path.join(baseDir, "Movies");
    const folderMovie = path.join(moviesDir, "Collision");
    fs.mkdirSync(folderMovie, { recursive: true });
    fs.writeFileSync(path.join(folderMovie, "Collision.mp4"), "");
    fs.writeFileSync(path.join(moviesDir, "Collision.mp4"), "");

    expect(() => fileUseCase.getVideos({ baseLocation: moviesDir })).toThrow(
      "Media id collision"
    );
  });

  it("builds series list and includes season folders", () => {
    const seriesDir = path.join(baseDir, "Series");
    const showDir = path.join(seriesDir, "ShowA");
    const seasonDir = path.join(showDir, "Season1");
    fs.mkdirSync(seasonDir, { recursive: true });

    const result = fileUseCase.getSeries({ baseLocation: seriesDir });

    expect(result.allIds).toEqual(["ShowA"]);
    expect(result.byId.ShowA.fileIds).toEqual(["Season1"]);
  });

  it("gets a video from a series folder", () => {
    const seriesDir = path.join(baseDir, "Series");
    const showDir = path.join(seriesDir, "ShowA");
    const seasonDir = path.join(showDir, "Season1");
    fs.mkdirSync(seasonDir, { recursive: true });
    fs.writeFileSync(path.join(seasonDir, "Episode1.mp4"), "");

    const result = fileUseCase.getVideo({
      baseLocation: seriesDir,
      folderName: "ShowA__Season1",
    });

    expect(result.parentId).toBe("ShowA");
    expect(result.name).toBe("Episode1.mp4");
  });

  it("throws when getVideo folderName is invalid", () => {
    const seriesDir = path.join(baseDir, "Series");
    fs.mkdirSync(seriesDir, { recursive: true });

    expect(() =>
      fileUseCase.getVideo({
        baseLocation: seriesDir,
        folderName: "invalid-format",
      })
    ).toThrow("Invalid series folderName format");
  });

  it("throws and logs when readFileInfo fails", () => {
    const fileUseCaseWithMock = FileUseCase({
      FileApi: {
        readFileInfo: () => {
          throw new Error("fail");
        },
      },
    });

    expect(() => fileUseCaseWithMock.getFileDirInfo("/bad")).toThrow("fail");
    expect(logE).toHaveBeenCalled();
  });

  it("logs readFile errors only when logError is true", () => {
    const fileUseCaseWithMock = FileUseCase({
      FileApi: {
        readFile: () => {
          throw new Error("fail");
        },
      },
    });

    fileUseCaseWithMock.readFile({ absolutePath: "/bad", logError: false });

    expect(logD).toHaveBeenCalledWith(
      "Unable to read file /bad: ",
      ""
    );
  });

  it("logs readFile errors with error when logError is true", () => {
    const error = new Error("fail");
    const fileUseCaseWithMock = FileUseCase({
      FileApi: {
        readFile: () => {
          throw error;
        },
      },
    });

    fileUseCaseWithMock.readFile({ absolutePath: "/bad" });

    expect(logD).toHaveBeenCalledWith(
      "Unable to read file /bad: ",
      error
    );
  });

  it("returns file extension", () => {
    const result = fileUseCase.getFileExt("movie.mp4");

    expect(result).toBe(".mp4");
  });
});
