jest.mock("config", () => {
  return jest.fn(() => ({
    SERVER_URL: "http://example.test:8080",
  }));
});

jest.mock("services/Api", () => ({
  getById: jest.fn(),
}));

jest.mock("../VideosRepository", () => ({
  getVideo: jest.fn(),
}));

import {
  getTrackSrc,
  getVideoSrc,
  getTrackPath,
  getVideoPath,
  loadVideo,
} from "./Player.presenter";
import { SERIES_CATEG, MOVIE_CATEG } from "common/constants";
import { getVideo } from "../VideosRepository";

describe("Player.presenter", () => {
  it("builds track and video src for movie", () => {
    const media = { id: "m1", name: "movie.mp4", sub: "sub.vtt" };
    expect(getTrackSrc({ mediaType: MOVIE_CATEG, media })).toBe(
      "http://example.test:8080/captions/m1/sub.vtt"
    );
    expect(getVideoSrc({ mediaType: MOVIE_CATEG, media })).toBe(
      "http://example.test:8080/videos/m1/movie.mp4"
    );
  });

  it("builds track and video src for series", () => {
    const media = {
      id: "e1",
      name: "ep.mp4",
      sub: "sub.vtt",
      parentId: "s1",
    };
    expect(getTrackSrc({ mediaType: SERIES_CATEG, media })).toBe(
      "http://example.test:8080/captions/s1/e1/sub.vtt"
    );
    expect(getVideoSrc({ mediaType: SERIES_CATEG, media })).toBe(
      "http://example.test:8080/series/s1/e1/ep.mp4"
    );
  });

  it("builds track and video paths (no host)", () => {
    const media = { id: "m1", name: "movie.mp4", sub: "sub.vtt" };
    expect(getTrackPath({ mediaType: MOVIE_CATEG, media })).toBe(
      "captions/m1/sub.vtt"
    );
    expect(getVideoPath({ mediaType: MOVIE_CATEG, media })).toBe(
      "videos/m1/movie.mp4"
    );
  });

  it("returns null track path when subtitle is missing", () => {
    const media = { id: "m1", name: "movie.mp4" };
    expect(getTrackPath({ mediaType: MOVIE_CATEG, media })).toBeNull();
  });

  it("loadVideo calls getVideo with correct resource", async () => {
    getVideo.mockResolvedValueOnce({ id: "m1" });
    const res = await loadVideo("m1", false);
    expect(getVideo).toHaveBeenCalledWith({
      api: expect.any(Object),
      id: "m1",
      resource: MOVIE_CATEG,
    });
    expect(res).toEqual({ id: "m1" });
  });
});
