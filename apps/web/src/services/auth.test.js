jest.mock("../config", () => {
  return jest.fn(() => ({
    SERVER_URL: "http://example.test:8080",
  }));
});

import { getCookie, login, refreshTokens, logout } from "./auth";

describe("auth service", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    document.cookie = "";
  });

  it("getCookie reads cookie by name", () => {
    document.cookie = "csrf_token=abc123";
    document.cookie = "other=zzz";

    expect(getCookie("csrf_token")).toBe("abc123");
  });

  it("login posts credentials and returns status/body", async () => {
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ accessToken: "token" }),
    });

    const res = await login({ username: "admin", password: "pw" });

    expect(fetch).toHaveBeenCalledWith(
      "http://example.test:8080/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
    expect(res).toEqual({ status: 200, accessToken: "token" });
  });

  it("refreshTokens returns true on ok response without error", async () => {
    document.cookie = "csrf_token=abc123";
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const res = await refreshTokens();

    expect(res).toBe(true);
  });

  it("refreshTokens returns false when body has error", async () => {
    document.cookie = "csrf_token=abc123";
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "bad" }),
    });

    const res = await refreshTokens();

    expect(res).toBe(false);
  });

  it("logout returns status", async () => {
    document.cookie = "csrf_token=abc123";
    fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({}),
    });

    const res = await logout();

    expect(res).toEqual({ status: 200 });
  });
});
