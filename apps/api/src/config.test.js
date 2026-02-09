jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

jest.mock("./common/MessageUtil", () => ({
  logD: jest.fn(),
}));

jest.mock("./common/AppServerConstant", () => ({
  USER_LOCATION: "/home/test",
}));

describe("config", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.SERVER_PROTOCOL = "http";
    process.env.SERVER_PORT = "8080";
    process.env.IMG_FOLDER_FALL_BACK = "/Images";
    process.env.VIDEO_PATH = "/videos";
    process.env.MOVIES_DIR = "Movies";
    process.env.SERIES_DIR = "Series";
    process.env.IMAGES_PORT_SERVER = "80";
    process.env.IMAGE_MAP = "movie_map.json";
  });

  it("loads env files for development", () => {
    process.env.NODE_ENV = "development";
    const dotenv = require("dotenv");

    require("./config");

    expect(dotenv.config).toHaveBeenCalledWith({ path: ".env.development" });
  });

  it("loads env files for production", () => {
    process.env.NODE_ENV = "production";
    const dotenv = require("dotenv");

    require("./config");

    expect(dotenv.config).toHaveBeenCalledWith({ path: ".env.production" });
  });

  it("loads env files for test", () => {
    process.env.NODE_ENV = "test";
    const dotenv = require("dotenv");

    require("./config");

    expect(dotenv.config).toHaveBeenCalledWith({ path: ".env.test" });
  });

  it("logs when NODE_ENV is missing", () => {
    delete process.env.NODE_ENV;
    const { logD } = require("./common/MessageUtil");

    require("./config");

    expect(logD).toHaveBeenCalled();
  });

  it("falls back to localhost when no external ip is found", () => {
    process.env.NODE_ENV = "test";
    const os = require("os");
    jest.spyOn(os, "networkInterfaces").mockReturnValue({
      lo0: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
    });

    const config = require("./config").default;
    const result = config();

    expect(result.host).toBe("127.0.0.1");
  });
});
