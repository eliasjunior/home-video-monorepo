import crypto from "crypto";
import jwtTokenProvider from "./providers/jwtTokenProvider";
import { createTokenConfig } from "./tokenConfig";
import { parseDurationToMs } from "../common/timeUtil";

export function createTokenService({
  tokenProvider = jwtTokenProvider,
  config = createTokenConfig(),
  idGenerator = () => crypto.randomUUID(),
  nowMs = () => Date.now(),
} = {}) {
  const { accessSecret, refreshSecret, accessTtl, refreshTtl } = config;

  function issueTokens({ userId, username }) {
    const accessToken = tokenProvider.sign(
      { sub: userId, username },
      { secret: accessSecret, expiresIn: accessTtl }
    );

    const jti = idGenerator();
    const refreshToken = tokenProvider.sign(
      { sub: userId, jti, type: "refresh" },
      { secret: refreshSecret, expiresIn: refreshTtl }
    );

    const refreshExpiresAtMs = nowMs() + parseDurationToMs(refreshTtl);

    return { accessToken, refreshToken, jti, refreshExpiresAtMs };
  }

  function verifyAccessToken(token) {
    return tokenProvider.verify(token, { secret: accessSecret });
  }

  function verifyRefreshToken(token) {
    return tokenProvider.verify(token, { secret: refreshSecret });
  }

  return {
    issueTokens,
    verifyAccessToken,
    verifyRefreshToken,
  };
}

const tokenService = createTokenService();

export const { issueTokens, verifyAccessToken, verifyRefreshToken } =
  tokenService;
