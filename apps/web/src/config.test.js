describe("config", () => {
  const originalEnv = process.env;
  const originalWindow = global.window;

  afterEach(() => {
    process.env = originalEnv;
    global.window = originalWindow;
    jest.resetModules();
  });

  it("uses env host and protocol in production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      REACT_APP_SERVER_HOST: "example.test",
      REACT_APP_SERVER_PROTOCOL: "https",
    };
    global.window = { location: { hostname: "ignored.test", protocol: "http:" } };
    jest.resetModules();
    const config = require("./config").default;

    const result = config();

    expect(result.SERVER_URL).toBe("https://example.test:8080");
  });

  it("uses http and port 8080 in non-production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      REACT_APP_SERVER_HOST: "dev.test",
    };
    global.window = { location: { hostname: "ignored.test", protocol: "https:" } };
    jest.resetModules();
    const config = require("./config").default;

    const result = config();

    expect(result.SERVER_URL).toBe("http://dev.test:8080");
  });
});
