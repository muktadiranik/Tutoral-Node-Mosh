const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const path = require("node:path");
const test = require("node:test");
const { describe, before, beforeEach, afterEach, after } = test;
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const winston = require("winston");

const jwtPrivateKey = "vidly-genre-tests-only-not-for-production";
process.env.NODE_ENV = "test";
process.env.NODE_CONFIG_DIR = path.join(__dirname, "../vidly/config");
process.env.vidly_jwtPrivateKey = jwtPrivateKey;

const config = require("config");
const Genre = require("../vidly/models/genre");
const sampleGenres = require("../vidly/data/genres");

function makeRequest(server) {
  const adminToken = jwt.sign({
    _id: new mongoose.Types.ObjectId().toHexString(), isAdmin: true,
  }, jwtPrivateKey);
  return (method, endpoint, body, raw = false, token = adminToken) => fetch(
    `http://127.0.0.1:${server.address().port}${endpoint}`,
    {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { "x-auth-token": token } : {}),
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );
}

test("Vidly imports work without a circular dependency or database side effects", (t) => {
  t.mock.method(mongoose, "connect", () => assert.fail("Import must not connect"));
  t.mock.method(Genre, "insertMany", () => assert.fail("Import must not seed"));

  const router = require("../vidly/routes/genres");
  const app = require("../vidly");
  const seed = require("../vidly/seed-genres");

  assert.equal(typeof router, "function");
  assert.equal(typeof app.listen, "function");
  assert.equal(typeof seed, "function");
  assert.equal(mongoose.connection.readyState, 0);
});

test("Genre schema validates and trims names without MongoDB", async () => {
  for (const name of ["Drama", "Horror", "x".repeat(255)]) {
    const genre = new Genre({ name: `  ${name}  ` });
    await genre.validate();
    assert.equal(genre.name, name);
  }

  for (const name of [undefined, null, "", "    ", "abcd", "x".repeat(256)]) {
    await assert.rejects(new Genre({ name }).validate(), (err) =>
      err instanceof mongoose.Error.ValidationError && Boolean(err.errors.name));
  }
});

describe("/api/genres", { concurrency: false }, () => {
  const databaseName = `vidly_integration_test_${randomUUID().replaceAll("-", "")}`;
  let server;
  let request;
  let genres;

  function assertTestDatabase() {
    assert.equal(process.env.NODE_ENV, "test");
    assert.equal(mongoose.connection.name, databaseName,
      "Refusing to clean a database not owned by this suite");
  }

  before(async () => {
    try {
      await mongoose.connect(
        process.env.VIDLY_TEST_MONGODB_URI || config.get("database"),
        { dbName: databaseName, serverSelectionTimeoutMS: 5000, maxPoolSize: 5 },
      );
    } catch (error) {
      throw new Error(
        "Start MongoDB or set VIDLY_TEST_MONGODB_URI before running the genre integration tests.",
        { cause: error },
      );
    }
    assertTestDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  });

  beforeEach(async () => {
    // Vidly exports an Express app, not a listening HTTP server.
    server = require("../vidly").listen(0, "127.0.0.1");
    await once(server, "listening");
    assertTestDatabase();
    assert.equal(await Genre.countDocuments(), 0, "The previous test must clean its data");
    genres = await Genre.insertMany(sampleGenres.map(({ name }) => ({ name })));
    request = makeRequest(server);
  });

  afterEach(async () => {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
      }
    } finally {
      server = undefined;
      if (mongoose.connection.readyState === 1) {
        assertTestDatabase();
        await Genre.deleteMany({});
      }
    }
  });

  after(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        assertTestDatabase();
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  test("Genre HTTP CRUD persists MongoDB IDs and returns the updated data", async (t) => {
    const updateSpy = t.mock.method(Genre, "findByIdAndUpdate");
    const baseline = await (await request("GET", "/api/genres")).json();
    assert.equal(baseline.length, 16);
    assert.ok(baseline.every((genre) => /^[a-f0-9]{24}$/.test(genre._id)));
    assert.deepEqual(await (await request("GET", "/api/genres/")).json(), baseline);

    const first = await request("GET", `/api/genres/${baseline[0]._id}`);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), baseline[0]);
    assert.equal((await request("GET", `/${baseline[0]._id}`)).status, 404);

    const response = await request("POST", "/api/genres", { name: "  Western  " });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.name, "Western");
    assert.match(created._id, /^[a-f0-9]{24}$/);
    assert.ok(!baseline.some((genre) => genre._id === created._id));
    assert.equal((await Genre.findById(created._id)).name, "Western");

    const update = await request("PUT", `/api/genres/${created._id}`, { name: "  Updated  " });
    assert.equal(update.status, 200);
    const updated = await update.json();
    assert.equal(updated._id, created._id);
    assert.equal(updated.name, "Updated");
    assert.equal((await Genre.findById(created._id)).name, "Updated");
    assert.deepEqual(updateSpy.mock.calls[0].arguments[2], {
      returnDocument: "after", runValidators: true,
    });
    assert.deepEqual(await (await request("GET", `/api/genres/${created._id}`)).json(), updated);

    const deletion = await request("DELETE", `/api/genres/${baseline[1]._id}`);
    assert.equal(deletion.status, 200);
    const remaining = await deletion.json();
    assert.equal(remaining.length, 16);
    assert.ok(!remaining.some((genre) => genre._id === baseline[1]._id));
    assert.ok(remaining.some((genre) => genre._id === created._id));
    assert.deepEqual(await (await request("GET", "/api/genres")).json(), remaining);
    assert.equal((await request("GET", `/api/genres/${baseline[1]._id}`)).status, 404);
    assert.equal(await Genre.findById(baseline[1]._id), null);
  });

  const invalidBodies = [undefined, {}, [], { name: "" }, { name: "    " },
    { name: "abcd" }, { name: "x".repeat(256) }, { name: 123 },
    { name: null }, { name: "Valid", extra: true }];

  for (const method of ["POST", "PUT"]) {
    for (const [index, body] of invalidBodies.entries()) {
      test(`${method} rejects invalid body ${index + 1} without changing data`, async (t) => {
        const createSpy = t.mock.method(Genre, "create");
        const updateSpy = t.mock.method(Genre, "findByIdAndUpdate");
        const baseline = await (await request("GET", "/api/genres")).json();
        const endpoint = method === "POST" ? "/api/genres" : `/api/genres/${genres[0]._id}`;
        const response = await request(method, endpoint, body);
        assert.equal(response.status, 400);
        assert.ok((await response.text()).length > 0);
        assert.deepEqual(await (await request("GET", "/api/genres")).json(), baseline);
        assert.equal(createSpy.mock.callCount(), 0);
        assert.equal(updateSpy.mock.callCount(), 0);
      });
    }
  }

  test("POST rejects malformed JSON without changing data", async () => {
    const baseline = await (await request("GET", "/api/genres")).json();
    const response = await request("POST", "/api/genres", '{"name":', true);
    assert.equal(response.status, 400);
    assert.deepEqual(await (await request("GET", "/api/genres")).json(), baseline);
  });

  test("POST accepts a name at the 255-character boundary", async () => {
    const response = await request("POST", "/api/genres", { name: "x".repeat(255) });
    assert.equal(response.status, 201);
    assert.equal(await Genre.countDocuments(), 17);
  });

  test("Genre HTTP preserves public reads, authentication, and admin-only deletion", async (t) => {
    const createSpy = t.mock.method(Genre, "create");
    const updateSpy = t.mock.method(Genre, "findByIdAndUpdate");
    const deleteSpy = t.mock.method(Genre, "findByIdAndDelete");
    const id = String(genres[0]._id);
    const memberToken = jwt.sign({
      _id: new mongoose.Types.ObjectId().toHexString(), isAdmin: false,
    }, jwtPrivateKey);

    const publicRead = await request("GET", "/api/genres", undefined, false, null);
    assert.equal(publicRead.status, 200);
    assert.equal((await publicRead.json()).length, 16);

    for (const [method, endpoint, body] of [
      ["POST", "/api/genres", { name: "Valid" }],
      ["PUT", `/api/genres/${id}`, { name: "Valid" }],
      ["DELETE", `/api/genres/${id}`, undefined],
    ]) {
      const response = await request(method, endpoint, body, false, null);
      assert.equal(response.status, 401);
      assert.equal(await response.text(), "Access denied");
    }

    const invalidToken = await request("DELETE", `/api/genres/${id}`, undefined, false, "invalid");
    assert.equal(invalidToken.status, 400);
    assert.equal(await invalidToken.text(), "Invalid token");

    const forbidden = await request("DELETE", `/api/genres/${id}`, undefined, false, memberToken);
    assert.equal(forbidden.status, 403);
    assert.equal(await forbidden.text(), "Forbidden");
    assert.equal(await Genre.countDocuments(), 16);
    assert.equal(createSpy.mock.callCount(), 0);
    assert.equal(updateSpy.mock.callCount(), 0);
    assert.equal(deleteSpy.mock.callCount(), 0);
  });

  const missingId = new mongoose.Types.ObjectId().toHexString();
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const id of ["1", "invalid", "0123456789ab", "z".repeat(24), missingId]) {
      test(`${method} returns 404 for ${id}`, async (t) => {
        const operation = {
          GET: "findById", PUT: "findByIdAndUpdate", DELETE: "findByIdAndDelete",
        }[method];
        const querySpy = t.mock.method(Genre, operation);
        const response = await request(method, `/api/genres/${id}`,
          method === "PUT" ? { name: "Valid" } : undefined);
        assert.equal(response.status, 404);
        assert.equal(await response.text(), "Genre not found");
        assert.equal(await Genre.countDocuments(), 16);
        // Only the well-formed missing ID may reach the real database query.
        assert.equal(querySpy.mock.callCount(), id === missingId ? 1 : 0);
        if (id === missingId) {
          assert.equal(querySpy.mock.calls[0].arguments[0], missingId);
        }
      });
    }
  }

  test("Genre HTTP errors are handled without leaking database details (injected failures)", async (t) => {
    const id = String(genres[0]._id);
    t.mock.method(winston, "error", () => {});

    for (const [operation, method, endpoint] of [
      ["find", "GET", "/api/genres"],
      ["findById", "GET", `/api/genres/${id}`],
      ["create", "POST", "/api/genres"],
      ["findByIdAndUpdate", "PUT", `/api/genres/${id}`],
      ["findByIdAndDelete", "DELETE", `/api/genres/${id}`],
    ]) {
      t.mock.method(Genre, operation, async () => {
        throw new Error("Private database connection details");
      }, { times: 1 });
      const response = await request(method, endpoint,
        ["POST", "PUT"].includes(method) ? { name: "Valid" } : undefined);
      assert.equal(response.status, 500);
      assert.equal(await response.text(), "An unexpected error occurred");
      assert.equal(await Genre.countDocuments(), 16);
    }

    t.mock.method(Genre, "create", async () => {
      await new Genre({ name: "x" }).validate();
    }, { times: 1 });
    const validation = await request("POST", "/api/genres", { name: "Valid" });
    assert.equal(validation.status, 400);
    assert.match(await validation.text(), /name/);
  });
});

test("Explicit genre seeding strips numeric IDs and closes its connection (mocked model)", async (t) => {
  const connect = t.mock.method(mongoose, "connect", async () => mongoose);
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const insert = t.mock.method(Genre, "insertMany", async (genres) => {
    assert.equal(genres.length, 16);
    for (const genre of genres) {
      assert.deepEqual(Object.keys(genre), ["name"]);
      await new Genre(genre).validate();
    }
    return genres;
  });
  t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-genres");

  await seed();
  assert.equal(connect.mock.calls[0].arguments[0],
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises");
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(disconnect.mock.callCount(), 1);

  insert.mock.mockImplementationOnce(async () => { throw new Error("Seed failed"); });
  await assert.rejects(seed(), /Seed failed/);
  assert.equal(disconnect.mock.callCount(), 2);
});
