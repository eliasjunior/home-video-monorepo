import { createAuthCookieService } from "./authCookieService";

describe("authCookieService", () => {
  const cfg = {
    cookieSecure: true,
    cookieSameSite: "Lax",
    cookieDomain: "example.com",
  };
  const cookieNames = {
    access: "access_token",
    refresh: "refresh_token",
    csrf: "csrf_token",
  };

  function createResponse() {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  }

  it("sets auth cookies with the expected names and values", () => {
    const service = createAuthCookieService({ cfg, cookieNames });
    const res = createResponse();

    service.setAuthCookies({
      res,
      session: {
        accessToken: "a",
        refreshToken: "r",
        csrfToken: "c",
      },
    });

    expect(res.cookie).toHaveBeenCalledTimes(3);
    expect(res.cookie).toHaveBeenCalledWith(
      "access_token",
      "a",
      expect.any(Object)
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "refresh_token",
      "r",
      expect.any(Object)
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "csrf_token",
      "c",
      expect.any(Object)
    );
  });

  it("clears auth cookies with the expected names", () => {
    const service = createAuthCookieService({ cfg, cookieNames });
    const res = createResponse();

    service.clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(3);
    expect(res.clearCookie).toHaveBeenCalledWith(
      "access_token",
      expect.any(Object)
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "refresh_token",
      expect.any(Object)
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "csrf_token",
      expect.any(Object)
    );
  });
});

