export function createAuthSessionService({
  tokenService,
  refreshTokenStore,
  nowMs = () => Date.now(),
} = {}) {
  function rotateRefreshSession({ refreshToken, username }) {
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      return { ok: false, status: 401, message: "Invalid refresh token" };
    }

    if (payload.type !== "refresh") {
      return { ok: false, status: 401, message: "Invalid refresh token" };
    }

    const record = refreshTokenStore.get(payload.jti);
    if (!record || record.userId !== payload.sub) {
      return { ok: false, status: 401, message: "Refresh token revoked" };
    }
    if (record.expiresAtMs < nowMs()) {
      refreshTokenStore.delete(payload.jti);
      return { ok: false, status: 401, message: "Refresh token expired" };
    }

    refreshTokenStore.delete(payload.jti);
    const { accessToken, refreshToken: newRefreshToken, jti, refreshExpiresAtMs } =
      tokenService.issueTokens({
        userId: payload.sub,
        username,
      });
    refreshTokenStore.save({
      jti,
      userId: payload.sub,
      expiresAtMs: refreshExpiresAtMs,
    });

    return {
      ok: true,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  function revokeRefreshSession({ refreshToken }) {
    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      refreshTokenStore.delete(payload.jti);
    } catch {
      // swallow invalid token on logout
    }
    return { ok: true };
  }

  return {
    rotateRefreshSession,
    revokeRefreshSession,
  };
}

