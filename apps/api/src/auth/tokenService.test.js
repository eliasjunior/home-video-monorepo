import jwt from "jsonwebtoken";

describe("tokenService", () => {
  let issueTokens;
  let verifyAccessToken;
  let verifyRefreshToken;
  let parseDurationToMs;
  let createTokenService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "access-secret";
    process.env.JWT_REFRESH_SECRET = "refresh-secret";
    process.env.JWT_ACCESS_TTL = "15m";
    process.env.JWT_REFRESH_TTL = "180d";
    jest.resetModules();
    ({
      issueTokens,
      verifyAccessToken,
      verifyRefreshToken,
      parseDurationToMs,
      createTokenService,
    } = await import("./tokenService.js"));
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

  it("supports injecting a token provider", () => {
    const sign = jest
      .fn()
      .mockReturnValueOnce("access-token")
      .mockReturnValueOnce("refresh-token");
    const verify = jest
      .fn()
      .mockReturnValueOnce({ sub: "user-1" })
      .mockReturnValueOnce({ sub: "user-1", jti: "jti-1", type: "refresh" });
    const tokenProvider = { sign, verify };
    const nowMs = jest.fn(() => 1000);
    const idGenerator = jest.fn(() => "jti-1");

    const tokenService = createTokenService({
      tokenProvider,
      config: {
        accessSecret: "a",
        refreshSecret: "r",
        accessTtl: "1m",
        refreshTtl: "2h",
      },
      idGenerator,
      nowMs,
    });

    const issued = tokenService.issueTokens({
      userId: "user-1",
      username: "admin",
    });
    const accessPayload = tokenService.verifyAccessToken("access-token");
    const refreshPayload = tokenService.verifyRefreshToken("refresh-token");

    expect(sign).toHaveBeenNthCalledWith(
      1,
      { sub: "user-1", username: "admin" },
      { secret: "a", expiresIn: "1m" }
    );
    expect(sign).toHaveBeenNthCalledWith(
      2,
      { sub: "user-1", jti: "jti-1", type: "refresh" },
      { secret: "r", expiresIn: "2h" }
    );
    expect(verify).toHaveBeenNthCalledWith(1, "access-token", { secret: "a" });
    expect(verify).toHaveBeenNthCalledWith(2, "refresh-token", {
      secret: "r",
    });
    expect(issued).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      jti: "jti-1",
      refreshExpiresAtMs: 2 * 60 * 60 * 1000 + 1000,
    });
    expect(accessPayload).toEqual({ sub: "user-1" });
    expect(refreshPayload).toEqual({
      sub: "user-1",
      jti: "jti-1",
      type: "refresh",
    });
  });
});
