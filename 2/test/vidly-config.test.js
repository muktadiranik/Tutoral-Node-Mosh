const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const projectDirectory = path.resolve(__dirname, "..");
const vidlyDirectory = path.join(projectDirectory, "vidly");
const entry = path.join(vidlyDirectory, "index.js");
const testKey = "vidly-config-tests-only-not-for-production";

function environment(overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://127.0.0.1:1/vidly_config_test?serverSelectionTimeoutMS=500",
    PORT: "0",
  };
  for (const name of ["NODE_CONFIG_DIR", "NODE_CONFIG", "NODE_APP_INSTANCE",
    "NODE_CONFIG_ENV", "NODE_CONFIG_STRICT_MODE", "vidly_jwtPrivateKey"]) {
    delete env[name];
  }
  return { ...env, ...overrides };
}

function run(args, cwd, env) {
  const result = spawnSync(process.execPath, args, {
    cwd, env, encoding: "utf8", timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

for (const cwd of [path.dirname(projectDirectory), projectDirectory, vidlyDirectory]) {
  test(`Vidly loads its own config and environment mapping from ${path.basename(cwd)}`, () => {
    const result = run(["-e", `
      const assert = require('node:assert/strict');
      const app = require(${JSON.stringify(entry)});
      const config = require(${JSON.stringify(require.resolve("config"))});
      assert.equal(typeof app.listen, 'function');
      assert.equal(config.get('jwtPrivateKey'), process.env.vidly_jwtPrivateKey);
      assert.equal(process.env.NODE_CONFIG_DIR, ${JSON.stringify(path.join(vidlyDirectory, "config"))});
      console.log('Configuration verified');
    `], cwd, environment({ vidly_jwtPrivateKey: testKey }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Configuration verified/);
    assert.equal((result.stdout + result.stderr).includes(testKey), false);
  });
}

test("Importing Vidly without a JWT key does not exit or connect to MongoDB", () => {
  const result = run(["-e", `
    const assert = require('node:assert/strict');
    const mongoose = require(${JSON.stringify(require.resolve("mongoose"))});
    mongoose.connect = () => assert.fail('Import must not connect to MongoDB');
    const app = require(${JSON.stringify(entry)});
    assert.equal(typeof app.listen, 'function');
    assert.equal(mongoose.connection.readyState, 0);
  `], projectDirectory, environment());
  assert.equal(result.status, 0, result.stderr);
});

test("Vidly startup rejects missing, empty, and whitespace JWT keys with a clear error", () => {
  for (const overrides of [{}, { vidly_jwtPrivateKey: "" }, { vidly_jwtPrivateKey: "   " }]) {
    const result = run([entry], projectDirectory, environment(overrides));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT private key not specified.*vidly_jwtPrivateKey/);
    assert.doesNotMatch(result.stderr, /Configuration property|Connected to MongoDB|Could not connect/);
    assert.equal(result.stdout, "");
  }
});

test("Vidly respects NODE_CONFIG_DIR and handles a completely absent JWT setting", () => {
  const override = path.join(projectDirectory, "config");
  const result = run([entry], projectDirectory, environment({ NODE_CONFIG_DIR: override }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT private key not specified.*vidly_jwtPrivateKey/);
  assert.doesNotMatch(result.stderr, /Configuration property/);
});
