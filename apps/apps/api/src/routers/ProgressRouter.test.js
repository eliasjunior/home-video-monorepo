import express from "express";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { createProgressRouter } from "./ProgressRouter";

describe("ProgressRouter", () => {
  let app;
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-video-progress-"));
    process.chdir(tempDir);

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: "user-1" };
      next();
    });
    app.use("/", createProgressRouter());
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores and returns progress", async () => {
    const payload = { videoId: "movie-1", positionSeconds: 12, durationSeconds: 100 };

    const post = await request(app).post("/progress").send(payload);
    expect(post.status).toBe(200);
    expect(post.body.videoId).toBe("movie-1");

    const get = await request(app).get("/progress/movie-1");
    expect(get.status).toBe(200);
    expect(get.body.positionSeconds).toBe(12);
  });

  it("returns 404 when progress is missing", async () => {
    const res = await request(app).get("/progress/missing");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid positionSeconds", async () => {
    const res = await request(app).post("/progress").send({
      videoId: "movie-1",
      positionSeconds: -1,
    });
    expect(res.status).toBe(400);
  });
});
