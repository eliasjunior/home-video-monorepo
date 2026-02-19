import { buildCookieOptions } from "./cookiePolicy";

describe("cookiePolicy.buildCookieOptions", () => {
  it("builds cookie options with required attributes", () => {
    const options = buildCookieOptions({
      isHttpOnly: true,
      path: "/auth",
      cfg: {
        cookieSecure: true,
        cookieSameSite: "Lax",
      },
    });

    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/auth",
    });
  });

  it("includes optional domain and maxAge when provided", () => {
    const options = buildCookieOptions({
      isHttpOnly: false,
      maxAgeMs: 60_000,
      cfg: {
        cookieSecure: false,
        cookieSameSite: "Strict",
        cookieDomain: "example.com",
      },
    });

    expect(options.domain).toBe("example.com");
    expect(options.maxAge).toBe(60_000);
    expect(options.httpOnly).toBe(false);
  });
});

