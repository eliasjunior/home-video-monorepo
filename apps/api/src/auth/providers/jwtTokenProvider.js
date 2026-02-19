import jwt from "jsonwebtoken";

export function createJwtTokenProvider({ jwtModule = jwt } = {}) {
  return {
    sign(payload, options) {
      return jwtModule.sign(payload, options.secret, {
        expiresIn: options.expiresIn,
      });
    },
    verify(token, options) {
      return jwtModule.verify(token, options.secret);
    },
  };
}

export default createJwtTokenProvider();

