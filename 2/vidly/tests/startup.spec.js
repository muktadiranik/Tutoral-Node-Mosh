const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const directories = [];
const resolved = (name) => JSON.stringify(require.resolve(name));

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

// Run actual startup in a child so fatal process exits cannot kill Jest.
// Every MongoDB operation is replaced before loading the application.
function runNode(source, { main = false, env = {} } = {}) {
  const root = path.join(os.tmpdir(), "opencode");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "vidly-jest-"));
  directories.push(directory);
  const preload = path.join(directory, "preload.js");
  fs.writeFileSync(preload, source);
  const args = main ? ["--require", preload, require.resolve("../index")] : [preload];
  const result = spawnSync(process.execPath, args, {
    cwd: directory,
    env: {
      ...process.env,
      NODE_CONFIG_DIR: path.resolve(__dirname, "../config"),
      vidly_jwtPrivateKey: "vidly-jest-startup-only-not-for-production",
      MONGODB_URI: "mongodb://127.0.0.1:1/vidly_jest",
      ...env,
    },
    encoding: "utf8",
    timeout: 12000,
  });
  assert.ifError(result.error);
  return { ...result, directory };
}

describe("Application startup (real child processes, mocked database)", () => {
  test("exports an app without connecting, listening, or adding fatal handlers on import", () => {
    const result = runNode(`
      const assert = require('node:assert/strict');
      const mongoose = require(${resolved("mongoose")});
      const express = require(${resolved("express")});
      mongoose.connect = () => assert.fail('Import must not connect');
      express.application.listen = () => assert.fail('Import must not listen');
      const exceptions = process.listenerCount('uncaughtException');
      const rejections = process.listenerCount('unhandledRejection');
      const app = require(${resolved("../index")});
      assert.equal(typeof app.listen, 'function');
      assert.equal(process.listenerCount('uncaughtException'), exceptions);
      assert.equal(process.listenerCount('unhandledRejection'), rejections);
      assert.equal(mongoose.connection.readyState, 0);
    `);
    expect(result.status).toBe(0);
  });

  test.each(["", "   "])("refuses to start with a blank JWT key %#", (key) => {
    const result = runNode("", { main: true, env: {
      NODE_CONFIG: JSON.stringify({ jwtPrivateKey: "" }),
      vidly_jwtPrivateKey: key,
    } });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/JWT private key not specified/);
    expect(result.stdout).not.toMatch(/Connected to MongoDB|Listening on port/);
  });

  test("does not listen or create MongoDB logging if the database connection fails", () => {
    const result = runNode(`
      const assert = require('node:assert/strict');
      const mongoose = require(${resolved("mongoose")});
      const express = require(${resolved("express")});
      const winston = require(${resolved("winston")});
      require(${resolved("winston-mongodb")});
      mongoose.connect = async () => { throw new Error('Simulated connection failure'); };
      winston.transports.MongoDB = class {
        constructor() { assert.fail('Logging must wait for the connection'); }
      };
      express.application.listen = () => assert.fail('HTTP must wait for the connection');
    `, { main: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not connect to MongoDB: Simulated connection failure");
  });

  test("reuses the connected MongoDB client for logging and honors PORT before listening", () => {
    const result = runNode(`
      const assert = require('node:assert/strict');
      const mongoose = require(${resolved("mongoose")});
      const express = require(${resolved("express")});
      const winston = require(${resolved("winston")});
      require(${resolved("winston-mongodb")});
      const config = require(${resolved("config")});
      const client = {};
      let connected = false;
      let loggingReady = false;
      mongoose.connect = async (uri) => {
        assert.equal(uri, config.get("database"));
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
          loggingReady = true;
        }
      };
      express.application.listen = (port, callback) => {
        assert.equal(port, '4321');
        assert.equal(loggingReady, true);
        callback();
        console.log('Startup order verified');
      };
    `, { main: true, env: { PORT: "4321" } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Startup order verified");
  });

  test.each([
    ["exception", "exceptions.log", "throw new Error(message);"],
    ["rejection", "rejections.log", "Promise.reject(new Error(message));"],
  ])("writes an unhandled %s to a real log file before exiting", (kind, filename, trigger) => {
    const message = `Simulated fatal ${kind} for Jest`;
    const result = runNode(`
      const mongoose = require(${resolved("mongoose")});
      const message = ${JSON.stringify(message)};
      mongoose.connect = () => {
        setImmediate(() => { ${trigger} });
        return new Promise(() => {});
      };
    `, { main: true });
    expect(result.status).toBe(1);
    const entries = fs.readFileSync(path.join(result.directory, filename), "utf8")
      .trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "error", message: expect.stringContaining(message) }),
    ]));
  });
});

describe("Database startup module", () => {
  const config = require("config");
  const mongoose = require("mongoose");
  const winston = require("winston");
  const database = require("../startup/database");
  const originalURI = process.env.MONGODB_URI;
  let MongoDB;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(winston, "info").mockImplementation(() => winston);
    jest.spyOn(winston, "add").mockImplementation(() => winston);
    MongoDB = jest.spyOn(winston.transports, "MongoDB").mockImplementation(function (options) {
      this.options = options;
    });
  });
  afterEach(() => {
    if (originalURI === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalURI;
  });

  test.each(["unset", "set"])("uses config.database with MONGODB_URI %s and keeps the shared client open", async (source) => {
    if (source === "unset") delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = "mongodb://127.0.0.1:1/custom_test";
    mongoose.connect.mockResolvedValueOnce(mongoose);
    const client = {};
    jest.spyOn(mongoose.connection, "getClient").mockReturnValue(client);

    await database();

    expect(mongoose.connect).toHaveBeenCalledWith(config.get("database"));
    expect(MongoDB).toHaveBeenCalledWith({ db: client, leaveConnectionOpen: true, level: "info" });
    expect(winston.add).toHaveBeenCalledTimes(1);
  });

  test("propagates connection failure and never attaches a transport", async () => {
    const error = new Error("Connection failed");
    mongoose.connect.mockRejectedValueOnce(error);
    await expect(database()).rejects.toBe(error);
    expect(MongoDB).not.toHaveBeenCalled();
    expect(winston.add).not.toHaveBeenCalled();
  });
});
