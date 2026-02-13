import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { getAuthHeader } from "../test/authHelper";

function createTempProject({ withVideos = true, withSeries = true }) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-video-"));
  const moviesDir = path.join(baseDir, "Movies");
  const seriesDir = path.join(baseDir, "Series");

  fs.mkdirSync(moviesDir, { recursive: true });
  fs.mkdirSync(seriesDir, { recursive: true });

  if (withVideos) {
    const movieFolder = path.join(moviesDir, "MovieA");
    fs.mkdirSync(movieFolder, { recursive: true });
    fs.writeFileSync(path.join(movieFolder, "MovieA.mp4"), "");
    fs.writeFileSync(path.join(movieFolder, "MovieA.srt"), "");
  }

  if (withSeries) {
    const showFolder = path.join(seriesDir, "ShowA");
    const seasonFolder = path.join(showFolder, "Season1");
    fs.mkdirSync(seasonFolder, { recursive: true });
    fs.writeFileSync(path.join(seasonFolder, "Episode1.mp4"), "");
  }

  return baseDir;
}

function createTempProjectWithFlatMovies() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-video-flat-"));
  const moviesDir = path.join(baseDir, "Movies");
  const seriesDir = path.join(baseDir, "Series");
  fs.mkdirSync(moviesDir, { recursive: true });
  fs.mkdirSync(seriesDir, { recursive: true });
  fs.writeFileSync(path.join(moviesDir, "FlatMovie.mp4"), "");
  fs.writeFileSync(path.join(moviesDir, "FlatMovie.srt"), "");
  return baseDir;
}

function buildAppWithEnv(baseDir) {
  process.env.NODE_ENV = "test";
  process.env.SERVER_PROTOCOL = "http";
  process.env.SERVER_PORT = "8080";
  process.env.IMG_FOLDER_FALL_BACK = "/Images";
  process.env.VIDEO_PATH = baseDir;
  process.env.VIDEO_PATH_LOCAL = baseDir;
  process.env.VIDEO_SOURCE_PROFILE = "local";
  process.env.MOVIES_DIR = "Movies";
  process.env.SERIES_DIR = "Series";
  process.env.IMAGES_PORT_SERVER = "80";
  process.env.IMAGE_MAP = "movie_map_test.json";

  jest.resetModules();
  return require("../../server.js").default;
}

describe("VideosRouter integration", () => {
  const tempDirs = [];

  afterAll(() => {
    tempDirs.forEach((dir) => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  it("GET /videos returns 200 with real files", async () => {
    const baseDir = createTempProject({ withVideos: true, withSeries: false });
    tempDirs.push(baseDir);
    const app = buildAppWithEnv(baseDir);
    const authHeader = await getAuthHeader(app);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.allIds.length).toBe(1);
  });

  it("GET /videos returns 500 when no videos exist", async () => {
    const baseDir = createTempProject({ withVideos: false, withSeries: false });
    tempDirs.push(baseDir);
    const app = buildAppWithEnv(baseDir);
    const authHeader = await getAuthHeader(app);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("GET /series returns 200 with real folders", async () => {
    const baseDir = createTempProject({ withVideos: false, withSeries: true });
    tempDirs.push(baseDir);
    const app = buildAppWithEnv(baseDir);
    const authHeader = await getAuthHeader(app);

    const response = await request(app)
      .get("/series")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.allIds.length).toBe(1);
  });

  it("GET /videos returns 200 when movies are flat files under Movies", async () => {
    const baseDir = createTempProjectWithFlatMovies();
    tempDirs.push(baseDir);
    const app = buildAppWithEnv(baseDir);
    const authHeader = await getAuthHeader(app);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body.allIds.length).toBe(1);
  });
});
