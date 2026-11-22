module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/vidly/tests/**/*.spec.js"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/vidly/tests/integration/"],
  setupFiles: ["<rootDir>/vidly/tests/setup-env.js"],
  setupFilesAfterEnv: ["<rootDir>/vidly/tests/setup-tests.js"],
  clearMocks: true,
  restoreMocks: true,
  resetModules: false,
  // node-config 5 uses ESM internally; use Node's native module support.
  transform: {},
  testTimeout: 15000,
  collectCoverageFrom: [
    "vidly/index.js",
    "vidly/routes/**/*.js",
    "vidly/models/**/*.js",
    "vidly/middleware/**/*.js",
    "vidly/startup/**/*.js",
  ],
  coverageDirectory: "<rootDir>/coverage/vidly",
  coverageProvider: "v8",
};
