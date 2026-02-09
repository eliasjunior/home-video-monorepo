import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { getAuthHeader } from "../test/authHelper";

function createTempProject() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-video-"));
  const moviesDir = path.join(baseDir, "Movies");
  fs.mkdirSync(moviesDir, { recursive: true });

  const movieFolder = path.join(moviesDir, "MovieA");
  fs.mkdirSync(movieFolder, { recursive: true });
  fs.writeFileSync(path.join(movieFolder, "MovieA.mp4"), "");
  fs.writeFileSync(path.join(movieFolder, "MovieA.srt"), "");

  return baseDir;
}

function buildAppWithEnv(baseDir) {
  process.env.NODE_ENV = "test";
  process.env.SERVER_PROTOCOL = "http";
  process.env.SERVER_PORT = "8080";
  process.env.IMG_FOLDER_FALL_BACK = "/Images";
  process.env.VIDEO_PATH = baseDir;
  process.env.MOVIES_DIR = "Movies";
  process.env.SERIES_DIR = "Series";
  process.env.IMAGES_PORT_SERVER = "80";
  process.env.IMAGE_MAP = "movie_map_test.json";

  jest.resetModules();
  return require("../../server.js").default;
}

describe("VideosRouter snapshot", () => {
  let baseDir;

  afterAll(() => {
    if (baseDir) {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it("matches the /videos response shape", async () => {
    baseDir = createTempProject();
    const app = buildAppWithEnv(baseDir);
    const authHeader = await getAuthHeader(app);

    const response = await request(app)
      .get("/videos")
      .set("Authorization", authHeader);

    expect(response.status).toBe(200);
    expect(response.body).toMatchSnapshot({
      byId: {
        MovieA: {
          description: expect.any(String),
          id: "MovieA",
          img: expect.any(String),
          name: "MovieA.mp4",
          sub: "MovieA.srt",
        },
      },
      allIds: ["MovieA"],
    });
  });
});
