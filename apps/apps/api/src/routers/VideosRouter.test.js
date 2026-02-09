import request from "supertest";
import { getAuthHeader } from "../test/authHelper";

jest.mock("../domain/fileUseCases", () => ({
  __esModule: true,
  default: {
    getVideos: jest.fn(),
    getSeries: jest.fn(),
    getFileDirInfo: jest.fn(),
    getVideo: jest.fn(),
  },
}));

jest.mock("../domain/streamingUseCases", () => ({
  __esModule: true,
  default: {
    createStream: jest.fn(),
  },
}));

jest.mock("../domain/streamingUseCases/StreamingUtilUseCase", () => ({
  getHeaderStream: jest.fn(),
  streamEvents: jest.fn(),
  getStartEndBytes: jest.fn(),
}));

jest.mock("../common/MessageUtil", () => ({
  logD: jest.fn(),
  logE: jest.fn(),
}));

describe("VideosRouter", () => {
  let app;
  let dataAccess;
  let streamingData;
  let streamingUtil;

  beforeEach(() => {
    jest.resetModules();
    app = require("../../server.js").default;
    dataAccess = require("../domain/fileUseCases").default;
    streamingData = require("../domain/streamingUseCases").default;
    streamingUtil = require("../domain/streamingUseCases/StreamingUtilUseCase");
  });

  it("GET /videos returns list when videos exist", async () => {
    const authHeader = await getAuthHeader(app);
    const payload = { byId: { a: { id: "a" } }, allIds: ["a"] };
    dataAccess.getVideos.mockReturnValueOnce(payload);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(payload);
  });

  it("GET /videos returns 500 when no videos exist", async () => {
    const authHeader = await getAuthHeader(app);
    const payload = { byId: {}, allIds: [] };
    dataAccess.getVideos.mockReturnValueOnce(payload);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("GET /series returns list when series exist", async () => {
    const authHeader = await getAuthHeader(app);
    const payload = { byId: { s: { id: "s" } }, allIds: ["s"] };
    dataAccess.getSeries.mockReturnValueOnce(payload);

    const response = await request(app)
      .get("/series")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(payload);
  });

  it("GET /series returns 500 when an error occurs", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getSeries.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const response = await request(app)
      .get("/series")
      .set("Authorization", authHeader);

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("GET /videos returns 500 when getVideos throws", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getVideos.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("GET / redirects to /videos", async () => {
    const authHeader = await getAuthHeader(app);
    const response = await request(app)
      .get("/")
      .set("Authorization", authHeader);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/videos");
  });

  it("GET /videos/:id returns item from movie map", async () => {
    const authHeader = await getAuthHeader(app);
    const { setMovieMap } = require("../common/Util");
    setMovieMap({
      byId: { movie1: { id: "movie1" } },
      allIds: ["movie1"],
    });

    const response = await request(app)
      .get("/videos/movie1")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "movie1" });
  });

  it("GET /videos/:id returns 501 when id is missing", async () => {
    const authHeader = await getAuthHeader(app);
    const { setMovieMap } = require("../common/Util");
    setMovieMap({
      byId: {},
      allIds: [],
    });
    dataAccess.getVideos.mockReturnValueOnce({
      byId: { movie1: { id: "movie1" } },
      allIds: ["movie1"],
    });

    const response = await request(app)
      .get("/videos/missing")
      .set("Authorization", authHeader);

    expect(response.status).toBe(501);
    expect(response.body).toHaveProperty("message");
  });

  it("loadMovie handles isSeries=true path", () => {
    const { setMovieMap, setSeriesMap } = require("../common/Util");
    setMovieMap({
      byId: { series1: { id: "series1" } },
      allIds: ["series1"],
    });
    setSeriesMap({
      byId: { series1: { id: "series1" } },
      allIds: ["series1"],
    });

    const router = require("./VideosRouter").default;
    const layer = router.stack.find(
      (l) => l.route && l.route.path === "/videos/:id"
    );
    const handler = layer.route.stack[0].handle;
    const req = { params: { id: "series1", isSeries: true } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("loadMovie returns 501 when series id is missing", () => {
    const { setMovieMap, setSeriesMap } = require("../common/Util");
    setMovieMap({
      byId: {},
      allIds: [],
    });
    setSeriesMap({
      byId: {},
      allIds: [],
    });
    dataAccess.getVideos.mockReturnValueOnce({
      byId: { movie1: { id: "movie1" } },
      allIds: ["movie1"],
    });

    const router = require("./VideosRouter").default;
    const layer = router.stack.find(
      (l) => l.route && l.route.path === "/videos/:id"
    );
    const handler = layer.route.stack[0].handle;
    const req = { params: { id: "missing", isSeries: true } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
      send: jest.fn().mockReturnThis(),
    };

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(501);
  });

  it("GET /videos/:folder/:fileName streams when range is provided", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getFileDirInfo.mockReturnValueOnce({ size: 1000 });
    streamingUtil.getStartEndBytes.mockReturnValueOnce({ start: 0, end: 99 });
    streamingUtil.getHeaderStream.mockReturnValueOnce({
      "Content-Range": "bytes 0-99/1000",
      "Accept-Ranges": "bytes",
      "Content-Length": 0,
      "Content-Type": "video/mp4",
    });
    streamingData.createStream.mockReturnValueOnce({ on: jest.fn() });
    streamingUtil.streamEvents.mockImplementationOnce(({ outputWriter }) => {
      outputWriter.end();
    });

    const response = await request(app)
      .get("/videos/Movies/movie.mp4")
      .set("Authorization", authHeader)
      .set("Range", "bytes=0-");

    expect(response.status).toBe(206);
    expect(streamingUtil.streamEvents).toHaveBeenCalled();
  });

  it("GET /videos/:folder/:fileName streams full file when range is missing", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getFileDirInfo.mockReturnValueOnce({ size: 0 });
    streamingData.createStream.mockReturnValueOnce({ on: jest.fn() });
    streamingUtil.streamEvents.mockImplementationOnce(({ outputWriter }) => {
      outputWriter.end();
    });

    const response = await request(app)
      .get("/videos/Movies/movie.mp4")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(streamingUtil.streamEvents).toHaveBeenCalled();
  });

  it("GET /videos/:folder/:fileName returns 500 when file lookup fails", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getFileDirInfo.mockImplementationOnce(() => {
      throw new Error("nope");
    });

    const response = await request(app)
      .get("/videos/Movies/movie.mp4")
      .set("Authorization", authHeader)
      .set("Range", "bytes=0-");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("GET /series/:id returns 501 when show is missing", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getVideo.mockReturnValueOnce(null);

    const response = await request(app)
      .get("/series/missing")
      .set("Authorization", authHeader);

    expect(response.status).toBe(501);
    expect(response.body).toHaveProperty("message");
  });

  it("GET /series/:id returns 200 when show exists", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getVideo.mockReturnValueOnce({ id: "show1" });

    const response = await request(app)
      .get("/series/show1")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "show1" });
  });

  it("GET /series/:parent/:folder/:fileName streams show when range is provided", async () => {
    const authHeader = await getAuthHeader(app);
    dataAccess.getFileDirInfo.mockReturnValueOnce({ size: 1000 });
    streamingUtil.getStartEndBytes.mockReturnValueOnce({ start: 0, end: 99 });
    streamingUtil.getHeaderStream.mockReturnValueOnce({
      "Content-Range": "bytes 0-99/1000",
      "Accept-Ranges": "bytes",
      "Content-Length": 0,
      "Content-Type": "video/mp4",
    });
    streamingData.createStream.mockReturnValueOnce({ on: jest.fn() });
    streamingUtil.streamEvents.mockImplementationOnce(({ outputWriter }) => {
      outputWriter.end();
    });

    const response = await request(app)
      .get("/series/ShowA/Season1/Episode1.mp4")
      .set("Authorization", authHeader)
      .set("Range", "bytes=0-");

    expect(response.status).toBe(206);
    expect(streamingUtil.streamEvents).toHaveBeenCalled();
  });
});
