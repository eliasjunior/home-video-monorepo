import {
  createEmptyTable,
  deriveMediaId,
  assertNoIdCollision,
  listFolderMedia,
  listFlatMedia,
  mergeMediaTables,
} from "./MediaScanUtil";

function createDirent(name, isDirectory) {
  return {
    name,
    isDirectory: () => isDirectory,
  };
}

describe("MediaScanUtil", () => {
  const fileExtEqual = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();
  const isThereVideoFile = (name) => [".mp4", ".mkv"].includes(fileExtEqual(name));
  const mapMedia = ({ files, folderName }) => ({
    id: folderName,
    name: files.find((f) => isThereVideoFile(f)),
  });

  it("creates an empty media table", () => {
    expect(createEmptyTable()).toEqual({ byId: {}, allIds: [] });
  });

  it("derives media id from filename", () => {
    expect(deriveMediaId("MovieA.mp4", fileExtEqual)).toBe("MovieA");
  });

  it("throws on id collisions", () => {
    expect(() =>
      assertNoIdCollision({
        id: "MovieA",
        baseLocation: "/videos/Movies",
        existingById: { MovieA: { id: "MovieA" } },
      })
    ).toThrow("Media id collision");
  });

  it("lists folder-based media entries", () => {
    const folderFiles = {
      MovieA: ["MovieA.mp4", "MovieA.srt"],
      SubOnly: ["SubOnly.srt"],
    };
    const getFolderName = () => ["MovieA", "SubOnly"];
    const getValidFileList = (folderName) => folderFiles[folderName] || [];
    const loadFiles = (folderName) => folderFiles[folderName] || [];

    const result = listFolderMedia({
      baseLocation: "/videos/Movies",
      getFolderName,
      readDirectory: jest.fn(),
      getValidFileList,
      isThereVideoFile,
      fileExtEqual,
      loadFiles,
      mapMedia,
    });

    expect(result.allIds).toEqual(["MovieA"]);
    expect(result.byId.MovieA.name).toBe("MovieA.mp4");
  });

  it("lists flat media entries", () => {
    const readDirectory = () => [
      createDirent("FlatMovie.mp4", false),
      createDirent("FlatMovie.srt", false),
      createDirent("folder", true),
    ];
    const filterValidFiles = (list) =>
      list.filter((f) => [".mp4", ".srt"].includes(fileExtEqual(f)));

    const result = listFlatMedia({
      baseLocation: "/videos/Movies",
      readDirectory,
      filterValidFiles,
      fileExtEqual,
      isThereVideoFile,
      mapMedia,
      existingById: {},
    });

    expect(result.allIds).toEqual(["FlatMovie"]);
    expect(result.byId.FlatMovie.name).toBe("FlatMovie.mp4");
    expect(result.byId.FlatMovie.isFlat).toBe(true);
  });

  it("merges folder and flat tables", () => {
    const result = mergeMediaTables(
      { byId: { A: { id: "A" } }, allIds: ["A"] },
      { byId: { B: { id: "B" } }, allIds: ["B"] }
    );

    expect(result).toEqual({
      byId: { A: { id: "A" }, B: { id: "B" } },
      allIds: ["A", "B"],
    });
  });
});

