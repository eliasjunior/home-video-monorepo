import jwt from "jsonwebtoken";

describe("tokenService", () => {
  let issueTokens;
  let verifyAccessToken;
  let verifyRefreshToken;
  let parseDurationToMs;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "access-secret";
    process.env.JWT_REFRESH_SECRET = "refresh-secret";
    process.env.JWT_ACCESS_TTL = "15m";
    process.env.JWT_REFRESH_TTL = "180d";
    jest.resetModules();
    ({ issueTokens, verifyAccessToken, verifyRefreshToken, parseDurationToMs } =
      await import("./tokenService.js"));
  });

  it("issues access and refresh tokens", () => {
    const { accessToken, refreshToken, jti, refreshExpiresAtMs } = issueTokens({
      userId: "user-1",
      username: "admin",
    });

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(jti).toBeTruthy();
    expect(refreshExpiresAtMs).toBeGreaterThan(Date.now());
  });

  it("verifies access token", () => {
    const accessToken = jwt.sign({ sub: "user-1", username: "admin" }, "access-secret", {
      expiresIn: "15m",
    });

    const payload = verifyAccessToken(accessToken);

    expect(payload.sub).toBe("user-1");
  });

  it("verifies refresh token", () => {
    const refreshToken = jwt.sign({ sub: "user-1", jti: "abc", type: "refresh" }, "refresh-secret", {
      expiresIn: "180d",
    });

    const payload = verifyRefreshToken(refreshToken);

    expect(payload.jti).toBe("abc");
  });

  it("parses duration strings and numbers", () => {
    expect(parseDurationToMs(1000)).toBe(1000);
    expect(parseDurationToMs("15m")).toBe(15 * 60 * 1000);
    expect(parseDurationToMs("2h")).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs("30s")).toBe(30 * 1000);
    expect(parseDurationToMs("1d")).toBe(24 * 60 * 60 * 1000);
  });

  it("returns 0 for invalid duration values", () => {
    expect(parseDurationToMs("bad")).toBe(0);
    expect(parseDurationToMs("10w")).toBe(0);
  });

  it("uses default secrets when env vars are missing", async () => {
    const prevAccess = process.env.JWT_ACCESS_SECRET;
    const prevRefresh = process.env.JWT_REFRESH_SECRET;
    const prevAccessTtl = process.env.JWT_ACCESS_TTL;
    const prevRefreshTtl = process.env.JWT_REFRESH_TTL;

    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_TTL;
    delete process.env.JWT_REFRESH_TTL;

    jest.resetModules();
    const { issueTokens: issueTokensDefault } = await import("./tokenService.js");
    const { accessToken, refreshToken } = issueTokensDefault({
      userId: "user-2",
      username: "admin",
    });

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    process.env.JWT_ACCESS_SECRET = prevAccess;
    process.env.JWT_REFRESH_SECRET = prevRefresh;
    process.env.JWT_ACCESS_TTL = prevAccessTtl;
    process.env.JWT_REFRESH_TTL = prevRefreshTtl;
  });
});
