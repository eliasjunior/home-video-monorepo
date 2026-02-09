jest.mock("../config", () => {
  return jest.fn(() => ({
    SERVER_URL: "http://example.test:8080",
  }));
});

import { requiredParameter, subscribeServerStatus } from "./Util";

describe("Util", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("requiredParameter throws by default", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => requiredParameter("test")).toThrow("test is required");
    spy.mockRestore();
  });

  it("requiredParameter logs error when not throwing", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    requiredParameter("test", false);
    expect(spy).toHaveBeenCalledWith("test is required *");
    spy.mockRestore();
  });

  it("subscribeServerStatus calls handler with true on ok", async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    const onHandleStatus = jest.fn();

    await subscribeServerStatus({ onHandleStatus });

    expect(onHandleStatus).toHaveBeenCalledWith(true);
  });

  it("subscribeServerStatus calls handler with false on error", async () => {
    fetch.mockRejectedValueOnce(new Error("network"));
    const onHandleStatus = jest.fn();

    await subscribeServerStatus({ onHandleStatus });

    expect(onHandleStatus).toHaveBeenCalledWith(false);
  });
});
