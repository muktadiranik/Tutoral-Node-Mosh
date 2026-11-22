const path = require("node:path");

process.env.NODE_ENV = "test";
// Retain the application's defaults and environment mapping, with a test-only
// deployment file so node-config recognizes NODE_ENV=test.
process.env.NODE_CONFIG_DIR = [
  path.resolve(__dirname, "../config"),
  path.resolve(__dirname, "config"),
].join(path.delimiter);
process.env.vidly_jwtPrivateKey = "vidly-jest-tests-only-not-for-production";
