import { createAuthSessionService } from "./authSessionService";

describe("authSessionService", () => {
  it("rotates refresh session when refresh token is valid", () => {
    const tokenService = {
      verifyRefreshToken: jest.fn(() => ({
        sub: "user-1",
        jti: "old-jti",
        type: "refresh",
      })),
      issueTokens: jest.fn(() => ({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        jti: "new-jti",
        refreshExpiresAtMs: 5000,
      })),
    };
    const refreshTokenStore = {
      get: jest.fn(() => ({ userId: "user-1", expiresAtMs: 4000 })),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const service = createAuthSessionService({
      tokenService,
      refreshTokenStore,
      nowMs: () => 1000,
    });

    const result = service.rotateRefreshSession({
      refreshToken: "token",
      username: "admin",
    });

    expect(result).toEqual({
      ok: true,
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    expect(refreshTokenStore.delete).toHaveBeenCalledWith("old-jti");
    expect(refreshTokenStore.save).toHaveBeenCalledWith({
      jti: "new-jti",
      userId: "user-1",
      expiresAtMs: 5000,
    });
  });

  it("returns invalid refresh token when verification fails", () => {
    const service = createAuthSessionService({
      tokenService: {
        verifyRefreshToken: jest.fn(() => {
          throw new Error("bad token");
        }),
      },
      refreshTokenStore: { get: jest.fn(), save: jest.fn(), delete: jest.fn() },
    });

    const result = service.rotateRefreshSession({
      refreshToken: "bad",
      username: "admin",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "Invalid refresh token",
    });
  });

  it("returns revoked when store does not have token record", () => {
    const service = createAuthSessionService({
      tokenService: {
        verifyRefreshToken: jest.fn(() => ({
          sub: "user-1",
          jti: "missing",
          type: "refresh",
        })),
      },
      refreshTokenStore: { get: jest.fn(() => null), save: jest.fn(), delete: jest.fn() },
    });

    const result = service.rotateRefreshSession({
      refreshToken: "token",
      username: "admin",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "Refresh token revoked",
    });
  });

  it("returns expired and deletes stale token when record is expired", () => {
    const refreshTokenStore = {
      get: jest.fn(() => ({ userId: "user-1", expiresAtMs: 500 })),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const service = createAuthSessionService({
      tokenService: {
        verifyRefreshToken: jest.fn(() => ({
          sub: "user-1",
          jti: "old-jti",
          type: "refresh",
        })),
      },
      refreshTokenStore,
      nowMs: () => 1000,
    });

    const result = service.rotateRefreshSession({
      refreshToken: "token",
      username: "admin",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "Refresh token expired",
    });
    expect(refreshTokenStore.delete).toHaveBeenCalledWith("old-jti");
  });

  it("logout revoke is best-effort and always succeeds", () => {
    const refreshTokenStore = { delete: jest.fn() };
    const service = createAuthSessionService({
      tokenService: {
        verifyRefreshToken: jest.fn(() => {
          throw new Error("invalid");
        }),
      },
      refreshTokenStore,
    });

    const result = service.revokeRefreshSession({ refreshToken: "bad" });

    expect(result).toEqual({ ok: true });
    expect(refreshTokenStore.delete).not.toHaveBeenCalled();
  });
});

