import crypto from "crypto";

export function createAuthLoginService({
  tokenService,
  refreshTokenStore,
  csrfTokenGenerator = () => crypto.randomBytes(32).toString("hex"),
} = {}) {
  function createLoginSession({ userId, username }) {
    const { accessToken, refreshToken, jti, refreshExpiresAtMs } =
      tokenService.issueTokens({
        userId,
        username,
      });

    refreshTokenStore.save({
      jti,
      userId,
      expiresAtMs: refreshExpiresAtMs,
    });

    return {
      accessToken,
      refreshToken,
      csrfToken: csrfTokenGenerator(),
    };
  }

  return {
    createLoginSession,
  };
}

