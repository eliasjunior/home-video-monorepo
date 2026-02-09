jest.mock("../config", () => {
  return jest.fn(() => ({
    SERVER_URL: "http://example.test:8080",
  }));
});

jest.mock("./auth", () => ({
  refreshTokens: jest.fn(),
}));

import { get, getById, getBlobUrl } from "./Api";
import { refreshTokens } from "./auth";

describe("Api service", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    global.fetch = jest.fn();
    refreshTokens.mockReset();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { pathname: "/", assign: jest.fn() },
    });
    URL.createObjectURL = jest.fn(() => "blob://url");
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("get calls API and returns status + body", async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ data: "ok" }),
    });

    const res = await get("videos");

    expect(fetch).toHaveBeenCalledWith("http://example.test:8080/videos", {
      credentials: "include",
    });
    expect(res).toEqual({ status: 200, data: "ok" });
  });

  it("handles non-JSON response bodies safely", async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });

    const res = await get("videos");

    expect(res).toEqual({ status: 200 });
  });

  it("getById retries after refresh on 401", async () => {
    fetch
      .mockResolvedValueOnce({
        status: 401,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ id: "movie-1" }),
      });
    refreshTokens.mockResolvedValueOnce(true);

    const res = await getById("videos", "movie-1");

    expect(refreshTokens).toHaveBeenCalled();
    expect(res).toEqual({ status: 200, id: "movie-1" });
  });

  it("redirects to /login after repeated 401", async () => {
    fetch.mockResolvedValue({
      status: 401,
      json: async () => ({}),
    });
    refreshTokens.mockResolvedValueOnce(false);

    const res = await get("videos");

    expect(window.location.assign).toHaveBeenCalledWith("/login");
    expect(res.status).toBe(401);
  });

  it("does not redirect when already on /login", async () => {
    fetch.mockResolvedValue({
      status: 401,
      json: async () => ({}),
    });
    refreshTokens.mockResolvedValueOnce(false);
    window.location.pathname = "/login";

    const res = await get("videos");

    expect(window.location.assign).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("getBlobUrl returns object URL from blob", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob(["test"], { type: "text/plain" }),
    });

    const url = await getBlobUrl("videos/Movies/movie.mp4");

    expect(url).toBe("blob://url");
  });

  it("getBlobUrl throws when response is not ok", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      blob: async () => new Blob(["err"], { type: "text/plain" }),
    });

    await expect(getBlobUrl("videos/Movies/movie.mp4")).rejects.toThrow(
      "Request failed with status 500"
    );
  });

  it("getBlobUrl retries after refresh on 401", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        blob: async () => new Blob(["err"], { type: "text/plain" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => new Blob(["ok"], { type: "text/plain" }),
      });
    refreshTokens.mockResolvedValueOnce(true);

    const url = await getBlobUrl("videos/Movies/movie.mp4");

    expect(refreshTokens).toHaveBeenCalled();
    expect(url).toBe("blob://url");
  });
});
