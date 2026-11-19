const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function temporaryDirectory(t) {
  const temporaryRoot = path.join(os.tmpdir(), "opencode");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "vidly-logging-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runStartup(t, preload) {
  const directory = temporaryDirectory(t);
  const preloadPath = path.join(directory, "preload.js");
  fs.writeFileSync(preloadPath, preload);
  const result = spawnSync(process.execPath, [
    "--require", preloadPath, require.resolve("../vidly"),
  ], {
    cwd: directory,
    env: {
      ...process.env,
      NODE_CONFIG_DIR: path.resolve(__dirname, "../vidly/config"),
      vidly_jwtPrivateKey: "vidly-logging-tests-only-not-for-production",
      MONGODB_URI: "mongodb://127.0.0.1:1/vidly_logging_test",
    },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.ifError(result.error);
  return { directory, result };
}

test("Vidly logs route errors without process handlers or MongoDB logging on import (mocked database)", (t) => {
  const directory = temporaryDirectory(t);
  const message = "Simulated route failure for logging regression test";
  const result = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const { once } = require('node:events');
    const mongoose = require(${JSON.stringify(require.resolve("mongoose"))});
    mongoose.connect = () => assert.fail('Test must not connect to MongoDB');
    const winston = require(${JSON.stringify(require.resolve("winston"))});
    require(${JSON.stringify(require.resolve("winston-mongodb"))});
    winston.transports.MongoDB = class {
      constructor() { assert.fail('Import must not initialize MongoDB logging'); }
    };
    const exceptionListeners = process.listenerCount('uncaughtException');
    const rejectionListeners = process.listenerCount('unhandledRejection');
    const { Genre } = require(${JSON.stringify(require.resolve("../vidly/models/genre"))});
    Genre.findById = async () => { throw new Error(${JSON.stringify(message)}); };
    const app = require(${JSON.stringify(require.resolve("../vidly"))});
    assert.equal(process.listenerCount('uncaughtException'), exceptionListeners);
    assert.equal(process.listenerCount('unhandledRejection'), rejectionListeners);

    (async () => {
      const server = app.listen(0, '127.0.0.1');
      try {
        await once(server, 'listening');
        const response = await fetch(
          'http://127.0.0.1:' + server.address().port + '/api/genres/507f1f77bcf86cd799439011',
          { signal: AbortSignal.timeout(5000) }
        );
        assert.equal(response.status, 500);
        assert.equal(await response.text(), 'An unexpected error occurred');
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `], {
    cwd: directory,
    env: {
      ...process.env,
      NODE_CONFIG_DIR: path.resolve(__dirname, "../vidly/config"),
    },
    encoding: "utf8",
    timeout: 15000,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const entries = fs.readFileSync(path.join(directory, "logfile.log"), "utf8")
    .trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "error");
  assert.equal(entries[0].message, message);
  assert.ok(entries[0].stack.startsWith(`Error: ${message}`));
});

for (const { event, filename, trigger } of [
  {
    event: "uncaught exception",
    filename: "exceptions.log",
    trigger: "throw new Error(message);",
  },
  {
    event: "unhandled rejection",
    filename: "rejections.log",
    trigger: "Promise.reject(new Error(message));",
  },
]) {
  test(`Vidly writes an ${event} to disk before exiting (mocked startup)`, (t) => {
    const message = `Simulated ${event} for logging regression test`;
    const { directory, result } = runStartup(t, `
      const mongoose = require(${JSON.stringify(require.resolve("mongoose"))});
      const message = ${JSON.stringify(message)};
      mongoose.connect = () => {
        setImmediate(() => { ${trigger} });
        return new Promise(() => {});
      };
    `);

    assert.equal(result.status, 1, result.stderr);
    const entries = fs.readFileSync(path.join(directory, filename), "utf8")
      .trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.ok(entries.some((entry) =>
      entry.level === "error" && entry.message.includes(message) &&
      entry.stack.includes(message)));
  });
}

test("Vidly attaches MongoDB logging only after connecting and reuses the app client (mocked startup)", (t) => {
  const { result } = runStartup(t, `
    const assert = require('node:assert/strict');
    const mongoose = require(${JSON.stringify(require.resolve("mongoose"))});
    const winston = require(${JSON.stringify(require.resolve("winston"))});
    const express = require(${JSON.stringify(require.resolve("express"))});
    require(${JSON.stringify(require.resolve("winston-mongodb"))});
    const client = {};
    let connected = false;
    let transportCreated = false;
    mongoose.connect = async (uri) => {
      assert.equal(uri, process.env.MONGODB_URI);
      connected = true;
      return mongoose;
    };
    mongoose.connection.getClient = () => {
      assert.equal(connected, true);
      return client;
    };
    winston.transports.MongoDB = class extends winston.transports.Console {
      constructor(options) {
        super(options);
        assert.equal(options.db, client);
        assert.equal(options.leaveConnectionOpen, true);
        assert.equal(options.level, 'info');
        transportCreated = true;
      }
    };
    express.application.listen = function (port, callback) {
      assert.equal(transportCreated, true);
      callback();
      console.log('MongoDB logging startup verified');
    };
  `);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /MongoDB logging startup verified/);
});

test("Vidly does not start HTTP or MongoDB logging when the database connection fails (mocked startup)", (t) => {
  const { result } = runStartup(t, `
    const assert = require('node:assert/strict');
    const mongoose = require(${JSON.stringify(require.resolve("mongoose"))});
    const winston = require(${JSON.stringify(require.resolve("winston"))});
    const express = require(${JSON.stringify(require.resolve("express"))});
    require(${JSON.stringify(require.resolve("winston-mongodb"))});
    mongoose.connect = async () => { throw new Error('Simulated connection failure'); };
    winston.transports.MongoDB = class {
      constructor() { assert.fail('MongoDB logging must wait for a connection'); }
    };
    express.application.listen = () => assert.fail('HTTP must wait for a connection');
  `);

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Could not connect to MongoDB: Simulated connection failure/);
  assert.doesNotMatch(result.stdout, /Connected to MongoDB|Listening on port/);
});
