jest.mock("config", () => {
  return jest.fn(() => ({
    SERVER_URL: "http://example.test:8080",
  }));
});

jest.mock("../VideosRepository", () => ({
  getVideosList: jest.fn(),
}));

jest.mock("services/Api", () => ({
  get: jest.fn(),
}));

import { getPosters, getMovieImg, getMovieImgPath } from "./Presenter";
import { getVideosList } from "../VideosRepository";

describe("Presenter", () => {
  beforeEach(() => {
    getVideosList.mockReset();
  });

  it("getPosters returns mapped ids when no error", async () => {
    getVideosList.mockResolvedValueOnce({
      mediaMap: { allIds: ["a"], byId: { a: { id: "a" } } },
    });

    const res = await getPosters(false);

    expect(res).toEqual({ allIds: ["a"], byId: { a: { id: "a" } } });
  });

  it("getPosters returns error message when mediaMap has error", async () => {
    getVideosList.mockResolvedValueOnce({
      mediaMap: { error: { message: "bad" } },
    });

    const res = await getPosters(true);

    expect(res).toEqual({ error: "bad", allIds: [], byId: {} });
  });

  it("getMovieImgPath uses remote url when provided", () => {
    expect(getMovieImgPath("id1", false, "http://img.test/x")).toBe(
      "http://img.test/x"
    );
  });

  it("getMovieImgPath builds series and movie paths", () => {
    expect(getMovieImgPath("id1", false)).toBe("images/id1");
    expect(getMovieImgPath("id2", true)).toBe("images/series/id2");
  });

  it("getMovieImg prefixes SERVER_URL when path is relative", () => {
    expect(getMovieImg("id1", false)).toBe(
      "http://example.test:8080/images/id1"
    );
  });
});
