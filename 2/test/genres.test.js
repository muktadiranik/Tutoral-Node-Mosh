const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const mongoose = require("mongoose");
const Genre = require("../vidly/models/genre");
const sampleGenres = require("../vidly/data/genres");

// Exercise the HTTP routes without connecting to or modifying a real database.
async function startMockApp(t) {
  const store = new Map(sampleGenres.map(({ name }) => {
    const genre = new Genre({ name });
    return [String(genre._id), genre];
  }));

  t.mock.method(Genre, "find", async () => [...store.values()]);
  t.mock.method(Genre, "findById", async (id) => store.get(String(id)) || null);
  t.mock.method(Genre, "create", async (data) => {
    const genre = new Genre(data);
    await genre.validate();
    store.set(String(genre._id), genre);
    return genre;
  });
  t.mock.method(Genre, "findByIdAndUpdate", async (id, update, options) => {
    assert.equal(options.returnDocument, "after");
    assert.equal(options.runValidators, true);
    const original = store.get(String(id));
    if (!original) return null;

    const genre = new Genre({ ...original.toObject(), ...update.$set });
    await genre.validate();
    store.set(String(id), genre);
    return genre;
  });
  t.mock.method(Genre, "findByIdAndDelete", async (id) => {
    const genre = store.get(String(id)) || null;
    store.delete(String(id));
    return genre;
  });

  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");

  const request = (method, endpoint, body, raw = false) => fetch(
    `http://127.0.0.1:${server.address().port}${endpoint}`,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );

  return { request, store };
}

test("Vidly imports work without a circular dependency or database side effects", (t) => {
  t.mock.method(mongoose, "connect", () => assert.fail("Import must not connect"));
  t.mock.method(Genre, "insertMany", () => assert.fail("Import must not seed"));

  const router = require("../vidly/routes/genres");
  const app = require("../vidly");
  const seed = require("../vidly/seed");

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

test("Genre HTTP CRUD uses MongoDB IDs and returns the updated data (mocked model)", async (t) => {
  const { request } = await startMockApp(t);
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

  const update = await request("PUT", `/api/genres/${created._id}`, { name: "  Updated  " });
  assert.equal(update.status, 200);
  const updated = await update.json();
  assert.equal(updated._id, created._id);
  assert.equal(updated.name, "Updated");
  assert.deepEqual(await (await request("GET", `/api/genres/${created._id}`)).json(), updated);

  const deletion = await request("DELETE", `/api/genres/${baseline[1]._id}`);
  assert.equal(deletion.status, 200);
  const remaining = await deletion.json();
  assert.equal(remaining.length, 16);
  assert.ok(!remaining.some((genre) => genre._id === baseline[1]._id));
  assert.ok(remaining.some((genre) => genre._id === created._id));
  assert.deepEqual(await (await request("GET", "/api/genres")).json(), remaining);
  assert.equal((await request("GET", `/api/genres/${baseline[1]._id}`)).status, 404);
});

test("Genre HTTP validation rejects invalid writes without changing data (mocked model)", async (t) => {
  const { request } = await startMockApp(t);
  const list = async () => (await request("GET", "/api/genres")).json();
  const baseline = await list();
  const invalidBodies = [undefined, {}, [], { name: "" }, { name: "    " },
    { name: "abcd" }, { name: "x".repeat(256) }, { name: 123 },
    { name: null }, { name: "Valid", extra: true }];

  for (const method of ["POST", "PUT"]) {
    for (const [index, body] of invalidBodies.entries()) {
      await t.test(`${method} rejects invalid body ${index + 1}`, async () => {
        const endpoint = method === "POST" ? "/api/genres" : `/api/genres/${baseline[0]._id}`;
        const response = await request(method, endpoint, body);
        assert.equal(response.status, 400);
        assert.ok((await response.text()).length > 0);
        assert.deepEqual(await list(), baseline);
      });
    }
  }

  const malformed = await request("POST", "/api/genres", '{"name":', true);
  assert.equal(malformed.status, 400);
  assert.deepEqual(await list(), baseline);

  const boundary = await request("POST", "/api/genres", { name: "x".repeat(255) });
  assert.equal(boundary.status, 201);
});

test("Genre HTTP requests reject malformed and missing IDs (mocked model)", async (t) => {
  const { request, store } = await startMockApp(t);
  const missingId = new mongoose.Types.ObjectId().toHexString();

  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const id of ["1", "invalid", "0123456789ab", "z".repeat(24), missingId]) {
      await t.test(`${method} returns 404 for ${id}`, async () => {
        const response = await request(method, `/api/genres/${id}`,
          method === "PUT" ? { name: "Valid" } : undefined);
        assert.equal(response.status, 404);
        assert.equal(await response.text(), "Genre not found");
        assert.equal(store.size, 16);
      });
    }
  }

  // Only the well-formed missing ID may reach database operations.
  for (const method of [Genre.findById, Genre.findByIdAndUpdate, Genre.findByIdAndDelete]) {
    assert.equal(method.mock.callCount(), 1);
    assert.equal(method.mock.calls[0].arguments[0], missingId);
  }
});

test("Genre HTTP errors are handled without leaking database details (mocked model)", async (t) => {
  const { request, store } = await startMockApp(t);
  const id = store.keys().next().value;
  t.mock.method(console, "error", () => {});

  for (const [operation, method, endpoint] of [
    ["find", "GET", "/api/genres"],
    ["findById", "GET", `/api/genres/${id}`],
    ["create", "POST", "/api/genres"],
    ["findByIdAndUpdate", "PUT", `/api/genres/${id}`],
    ["findByIdAndDelete", "DELETE", `/api/genres/${id}`],
  ]) {
    Genre[operation].mock.mockImplementationOnce(async () => {
      throw new Error("Private database connection details");
    });
    const response = await request(method, endpoint,
      ["POST", "PUT"].includes(method) ? { name: "Valid" } : undefined);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "An unexpected error occurred");
    assert.equal(store.size, 16);
  }

  Genre.create.mock.mockImplementationOnce(async () => {
    await new Genre({ name: "x" }).validate();
  });
  const validation = await request("POST", "/api/genres", { name: "Valid" });
  assert.equal(validation.status, 400);
  assert.match(await validation.text(), /name/);
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
  const seed = require("../vidly/seed");

  await seed();
  assert.equal(connect.mock.calls[0].arguments[0],
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises");
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(disconnect.mock.callCount(), 1);

  insert.mock.mockImplementationOnce(async () => { throw new Error("Seed failed"); });
  await assert.rejects(seed(), /Seed failed/);
  assert.equal(disconnect.mock.callCount(), 2);
});
