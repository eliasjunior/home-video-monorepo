describe("config", () => {
  const originalEnv = process.env;
  const originalWindow = globalThis.window;

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    jest.resetModules();
  });

  it("uses env host and protocol in production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      REACT_APP_SERVER_HOST: "example.test",
      REACT_APP_SERVER_PROTOCOL: "https",
    };
    Object.defineProperty(globalThis, "window", {
      value: { location: { hostname: "ignored.test", protocol: "http:" } },
      configurable: true,
      writable: true,
    });
    jest.resetModules();
    const config = require("./config").default;

    const result = config();

    expect(result.SERVER_URL).toBe("https://example.test:8080");
  });

  it("uses window hostname and http in development", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      REACT_APP_SERVER_HOST: "dev.test",
    };
    Object.defineProperty(globalThis, "window", {
      value: { location: { hostname: "dev.test", protocol: "https:" } },
      configurable: true,
      writable: true,
    });
    jest.resetModules();
    const config = require("./config").default;

    const result = config();

    expect(result.SERVER_URL).toBe("http://dev.test:8080");
  });
});
