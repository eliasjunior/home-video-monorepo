import {
  getStartEndBytes,
  getHeaderStream,
  streamEvents,
} from "./StreamingUtilUseCase";
import { BASE_STREAM_CALC, EXPONENT } from "../../common/AppServerConstant";

describe("StreamingUtilUseCase.getStartEndBytes", () => {
  const chunkSize = Math.pow(BASE_STREAM_CALC, EXPONENT);

  it("calculates end within file size", () => {
    const size = 100000;
    const { start, end } = getStartEndBytes("bytes=0-", size);

    expect(start).toBe(0);
    expect(end).toBe(Math.min(chunkSize, size - 1));
  });

  it("throws when range is missing", () => {
    expect(() => getStartEndBytes(undefined, 1000)).toThrow();
  });

  it("caps end at size - 1 when range is near the end", () => {
    const size = 1000;
    const { start, end } = getStartEndBytes("bytes=900-", size);

    expect(start).toBe(900);
    expect(end).toBe(999);
  });

  it("handles non-numeric ranges by treating start as 0", () => {
    const size = 2000;
    const { start, end } = getStartEndBytes("bytes=-", size);

    expect(start).toBe(0);
    expect(end).toBe(Math.min(chunkSize, size - 1));
  });
});

describe("StreamingUtilUseCase.streamEvents", () => {
  it("throws when readStream is missing", () => {
    expect(() => streamEvents({ outputWriter: {} })).toThrow("stream is required");
  });

  it("throws when outputWriter is missing", () => {
    const readStream = { on: jest.fn() };
    expect(() => streamEvents({ readStream })).toThrow("outputWriter is required");
  });

  it("handles open/data/end events", () => {
    const handlers = {};
    const readStream = {
      on: (event, cb) => {
        handlers[event] = cb;
      },
    };
    const outputWriter = {
      write: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    streamEvents({ readStream, useCaseLabel: "video", outputWriter });

    handlers.open();
    handlers.data(Buffer.from("x"));
    handlers.end();

    expect(outputWriter.write).toHaveBeenCalled();
    expect(outputWriter.status).toHaveBeenCalledWith(200);
    expect(outputWriter.end).toHaveBeenCalled();
  });

  it("handles error event", () => {
    const handlers = {};
    const readStream = {
      on: (event, cb) => {
        handlers[event] = cb;
      },
    };
    const outputWriter = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    streamEvents({ readStream, useCaseLabel: "video", outputWriter });

    handlers.error(new Error("fail"));

    expect(outputWriter.status).toHaveBeenCalledWith(500);
    expect(outputWriter.end).toHaveBeenCalled();
  });
});

describe("StreamingUtilUseCase.getHeaderStream", () => {
  it("builds range headers", () => {
    const headers = getHeaderStream({ start: 0, end: 9, size: 100 });

    expect(headers["Content-Range"]).toBe("bytes 0-9/100");
    expect(headers["Accept-Ranges"]).toBe("bytes");
    expect(headers["Content-Length"]).toBe(10);
    expect(headers["Content-Type"]).toBe("video/mp4");
  });
});
