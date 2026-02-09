import fs from "fs";
import streaming from "./index";

jest.mock("fs", () => ({
  createReadStream: jest.fn(),
}));

jest.mock("../../common/MessageUtil", () => ({
  logE: jest.fn(),
}));

describe("streamingUseCases.createStream", () => {
  beforeEach(() => {
    fs.createReadStream.mockReset();
  });

  it("creates ranged stream when start is integer", () => {
    const stream = { id: "stream" };
    fs.createReadStream.mockReturnValueOnce(stream);

    const result = streaming.createStream({
      fileAbsPath: "/file.mp4",
      start: 0,
      end: 100,
    });

    expect(result).toBe(stream);
    expect(fs.createReadStream).toHaveBeenCalledWith("/file.mp4", {
      start: 0,
      end: 100,
    });
  });

  it("creates full stream when start is not integer", () => {
    const stream = { id: "stream" };
    fs.createReadStream.mockReturnValueOnce(stream);

    const result = streaming.createStream({
      fileAbsPath: "/file.mp4",
      start: "0",
      end: 100,
    });

    expect(result).toBe(stream);
    expect(fs.createReadStream).toHaveBeenCalledWith("/file.mp4");
  });

  it("logs and rethrows when createReadStream throws", () => {
    fs.createReadStream.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(() =>
      streaming.createStream({ fileAbsPath: "/file.mp4", start: 0, end: 1 })
    ).toThrow("boom");
  });
});
