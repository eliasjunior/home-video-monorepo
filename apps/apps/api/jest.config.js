module.exports = {
  setupFiles: ["<rootDir>/src/test/setupEnv.js"],
  setupFilesAfterEnv: ["<rootDir>/src/test/setupJest.js"],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/test/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "src/common/Util.js": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coveragePathIgnorePatterns: [
    "/src/common/MessageUtil.js",
    "/src/libs/HttpLib.js",
    "/src/routers/CaptionsRouter.js",
    "/src/routers/ImagesRouter.js",
    "/src/domain/fileUseCases/index.js",
  ],
};
