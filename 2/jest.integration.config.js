const vidly = require("./jest.vidly.config");

module.exports = {
  ...vidly,
  displayName: "vidly-integration",
  roots: ["<rootDir>/vidly/tests/integration"],
  testMatch: ["**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  // Reuse test environment variables, but NOT the mocked MongoDB setup.
  setupFilesAfterEnv: ["<rootDir>/vidly/tests/integration/setup-db.js"],
  testTimeout: 20000,
  coverageDirectory: "<rootDir>/coverage/vidly-integration",
};
