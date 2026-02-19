import { createAuthLoginService } from "./authLoginService";

describe("authLoginService", () => {
  it("creates login session with tokens, store save and csrf token", () => {
    const tokenService = {
      issueTokens: jest.fn(() => ({
        accessToken: "access",
        refreshToken: "refresh",
        jti: "jti-1",
        refreshExpiresAtMs: 1234,
      })),
    };
    const refreshTokenStore = { save: jest.fn() };
    const csrfTokenGenerator = jest.fn(() => "csrf-1");
    const service = createAuthLoginService({
      tokenService,
      refreshTokenStore,
      csrfTokenGenerator,
    });

    const result = service.createLoginSession({
      userId: "user-1",
      username: "admin",
    });

    expect(tokenService.issueTokens).toHaveBeenCalledWith({
      userId: "user-1",
      username: "admin",
    });
    expect(refreshTokenStore.save).toHaveBeenCalledWith({
      jti: "jti-1",
      userId: "user-1",
      expiresAtMs: 1234,
    });
    expect(result).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      csrfToken: "csrf-1",
    });
  });
});

