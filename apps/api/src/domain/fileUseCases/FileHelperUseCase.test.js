import {
  filterValidFiles,
  getFilesFolder,
  getFolderName,
  isThereVideoFile,
  verifyingOrphanFiles,
} from "./FileHelperUseCase";

function createDirent(name, isDirectory) {
  return {
    name,
    isDirectory: () => isDirectory,
  };
}

describe("FileHelperUseCase", () => {
  it("filters only valid files (video/sub/img)", () => {
    const files = ["a.mp4", "b.srt", "c.jpg", "d.txt"];
    const ext = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();

    const result = filterValidFiles(files, ext);

    expect(result).toEqual(["a.mp4", "b.srt", "c.jpg"]);
  });

  it("detects video files", () => {
    const ext = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();

    expect(isThereVideoFile("movie.mkv", ext)).toBe(true);
    expect(isThereVideoFile("subtitle.srt", ext)).toBe(false);
  });

  it("gets folder names only from directories", () => {
    const readDirectory = () => [
      createDirent("Movies", true),
      createDirent("file.txt", false),
    ];

    const result = getFolderName("/base", { readDirectory });

    expect(result).toEqual(["Movies"]);
  });

  it("logs orphan files when files exist in base folder", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const readDirectory = () => [
      createDirent("orphan.mp4", false),
      createDirent("child", true),
    ];
    const ext = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();

    verifyingOrphanFiles("/base", { readDirectory, fileExtEqual: ext });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("logs info when no orphan files exist", () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const readDirectory = () => [createDirent("child", true)];
    const ext = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();

    verifyingOrphanFiles("/base", { readDirectory, fileExtEqual: ext });

    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("returns [] when getFilesFolder fails", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const readDirectory = () => {
      throw new Error("fail");
    };

    const result = getFilesFolder("/base", readDirectory);

    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
