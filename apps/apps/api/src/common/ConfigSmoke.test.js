import { config } from "./AppServerConstant";

describe("Config smoke", () => {
  it("loads required config values", () => {
    expect(config).toBeTruthy();
    expect(config.protocol).toBeTruthy();
    expect(config.port).toBeTruthy();
    expect(config.imagePort).toBeTruthy();
    expect(config.imageMapFileName).toBeTruthy();
    expect(config.serverUrl).toContain(config.protocol);
  });
});
