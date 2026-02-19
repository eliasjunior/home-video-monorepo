import request from "supertest";
import express from "express";
import { createCaptionsRouter } from "./CaptionsRouter";
import subsrt from "subsrt";
import { streamEvents } from "../domain/streamingUseCases/StreamingUtilUseCase";

jest.mock("subsrt", () => ({
  __esModule: true,
  default: {
    convert: jest.fn(),
  },
}));

jest.mock("../domain/streamingUseCases/StreamingUtilUseCase", () => ({
  streamEvents: jest.fn(),
}));

describe("CaptionsRouter", () => {
  const appConfig = {
    videosPath: "/videos",
    moviesDir: "Movies",
    seriesDir: "Series",
  };

  let fileService;
  let streamService;
  let app;

  beforeEach(() => {
    fileService = {
      getFileExt: jest.fn(),
      readFile: jest.fn(),
    };
    streamService = {
      createStream: jest.fn(() => ({ on: jest.fn() })),
    };
    streamEvents.mockReset();
    subsrt.convert.mockReset();

    app = express();
    app.use(
      "/",
      createCaptionsRouter({
        appConfig,
        fileService,
        streamService,
      })
    );
  });

  it("streams .vtt caption files for movies", async () => {
    fileService.getFileExt.mockReturnValueOnce(".vtt");
    streamEvents.mockImplementationOnce(({ outputWriter }) => {
      outputWriter.end();
    });

    const response = await request(app).get("/captions/MovieA/subtitle.vtt");

    expect(response.status).toBe(200);
    expect(streamService.createStream).toHaveBeenCalledWith({
      fileAbsPath: "/videos/Movies/MovieA/subtitle.vtt",
    });
    expect(streamEvents).toHaveBeenCalled();
  });

  it("streams .vtt caption files for series", async () => {
    fileService.getFileExt.mockReturnValueOnce(".vtt");
    streamEvents.mockImplementationOnce(({ outputWriter }) => {
      outputWriter.end();
    });

    const response = await request(app).get(
      "/captions/ShowA/Season1/Episode1.vtt"
    );

    expect(response.status).toBe(200);
    expect(streamService.createStream).toHaveBeenCalledWith({
      fileAbsPath: "/videos/Series/ShowA/Season1/Episode1.vtt",
    });
    expect(streamEvents).toHaveBeenCalled();
  });

  it("converts non-vtt subtitles to vtt", async () => {
    fileService.getFileExt.mockReturnValueOnce(".srt");
    fileService.readFile.mockReturnValueOnce(
      "1\n00:00:00,000 --> 00:00:01,000\nHello\n"
    );
    subsrt.convert.mockReturnValueOnce("WEBVTT\n\n00:00.000 --> 00:01.000\nHello");

    const response = await request(app).get("/captions/MovieA/subtitle.srt");

    expect(response.status).toBe(200);
    expect(fileService.readFile).toHaveBeenCalledWith({
      absolutePath: "/videos/Movies/MovieA/subtitle.srt",
    });
    expect(subsrt.convert).toHaveBeenCalled();
    expect(response.text).toContain("WEBVTT");
  });

  it("returns 500 when caption lookup fails", async () => {
    fileService.getFileExt.mockReturnValueOnce(".srt");
    fileService.readFile.mockImplementationOnce(() => {
      throw new Error("missing");
    });

    const response = await request(app).get("/captions/MovieA/missing.srt");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });
});

