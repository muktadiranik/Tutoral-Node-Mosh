const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const mongoose = require("mongoose");
const winston = require("winston");
const { token } = require("../test-support/vidly");
const { Movie, validate } = require("../vidly/models/movie");
const { Genre, genreSchema } = require("../vidly/models/genre");

// Exercise the HTTP API and real document validation without MongoDB writes.
async function startMockApp(t) {
  const genres = [new Genre({ name: "Horror" }), new Genre({ name: "Comedy" })];
  const store = new Map(["Zulu Movie", "Alpha Movie"].map((title) => {
    const movie = new Movie({
      title,
      genre: { _id: genres[0]._id, name: genres[0].name },
      numberInStock: 10,
      dailyRentalRate: 2.5,
    });
    return [String(movie._id), movie];
  }));

  t.mock.method(Genre, "findById", async (id) =>
    genres.find((genre) => String(genre._id) === String(id).toLowerCase()) || null);
  t.mock.method(Movie, "find", () => ({
    sort: async (sort) => {
      assert.deepEqual(sort, { title: 1 });
      return [...store.values()].sort((a, b) => a.title.localeCompare(b.title));
    },
  }));
  t.mock.method(Movie, "findById", async (id) => store.get(String(id)) || null);
  t.mock.method(Movie, "create", async (data) => {
    const movie = new Movie(data);
    await movie.validate();
    store.set(String(movie._id), movie);
    return movie;
  });
  t.mock.method(Movie, "findByIdAndUpdate", async (id, update, options) => {
    assert.deepEqual(options, { returnDocument: "after", runValidators: true });
    const original = store.get(String(id));
    if (!original) return null;

    // Mongoose strips undefined update values rather than clearing stored fields.
    const fields = Object.fromEntries(Object.entries(update.$set)
      .filter(([, value]) => value !== undefined));
    const movie = new Movie({ ...original.toObject(), ...fields });
    await movie.validate();
    store.set(String(id), movie);
    return movie;
  });
  t.mock.method(Movie, "findByIdAndDelete", async (id) => {
    const movie = store.get(String(id)) || null;
    store.delete(String(id));
    return movie;
  });

  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");

  const authToken = token();
  const request = (method, endpoint, body) => fetch(
    `http://127.0.0.1:${server.address().port}${endpoint}`,
    {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        "x-auth-token": authToken,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );

  const payload = {
    title: "The Matrix",
    genreId: String(genres[0]._id),
    dailyRentalRate: 2.5,
  };
  return { request, store, genres, payload };
}

test("Movie schema embeds the shared genre schema and validates its fields offline", async () => {
  assert.equal(typeof Movie, "function");
  assert.equal(Movie.schema.path("genre").schema, genreSchema);
  const data = {
    title: "  The Matrix  ",
    genre: { _id: new mongoose.Types.ObjectId(), name: "Action" },
    numberInStock: 0,
    dailyRentalRate: 0,
  };
  const movie = new Movie(data);
  await movie.validate();
  assert.equal(movie.title, "The Matrix");
  assert.equal(movie.genre.name, "Action");
  assert.equal(movie.numberInStock, 0);

  await new Movie({ ...data, title: "x".repeat(255), numberInStock: 255,
    dailyRentalRate: 255 }).validate();
  for (const [field, value] of [
    ["title", undefined], ["title", "abcd"], ["title", "x".repeat(256)],
    ["genre", undefined], ["genre", { name: "bad" }],
    ["numberInStock", undefined], ["numberInStock", -1],
    ["numberInStock", 256], ["numberInStock", 1.5],
    ["dailyRentalRate", undefined], ["dailyRentalRate", -1], ["dailyRentalRate", 256],
  ]) {
    await assert.rejects(new Movie({ ...data, [field]: value }).validate(),
      (err) => err instanceof mongoose.Error.ValidationError);
  }

  const normalized = validate({
    title: "  The Matrix  ", genreId: String(data.genre._id),
    dailyRentalRate: "2.5",
  });
  assert.equal(normalized.error, undefined);
  assert.equal(normalized.value.title, "The Matrix");
  assert.equal(normalized.value.numberInStock, undefined);
  assert.equal(normalized.value.dailyRentalRate, 2.5);
  assert.equal(validate({ ...normalized.value, numberInStock: 10 })
    .error.details[0].message, '"numberInStock" is not allowed');
});

test("Movie HTTP reads, updates, and deletes existing movies (mocked model)", async (t) => {
  const { request, store, genres, payload } = await startMockApp(t);
  const list = await request("GET", "/api/movies");
  assert.equal(list.status, 200);
  const baseline = await list.json();
  assert.deepEqual(baseline.map(({ title }) => title), ["Alpha Movie", "Zulu Movie"]);
  const first = await request("GET", `/api/movies/${baseline[0]._id}`);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), baseline[0]);
  assert.equal((await request("GET", `/${baseline[0]._id}`)).status, 404);

  const id = baseline[0]._id;
  const update = await request("PUT", `/api/movies/${id}`, {
    ...payload, title: "  Updated Movie  ", genreId: String(genres[1]._id),
    dailyRentalRate: "0",
  });
  assert.equal(update.status, 200);
  const updated = await update.json();
  assert.equal(updated._id, id);
  assert.equal(updated.title, "Updated Movie");
  assert.deepEqual(updated.genre, { _id: String(genres[1]._id), name: genres[1].name });
  assert.equal(updated.numberInStock, baseline[0].numberInStock);
  assert.equal(updated.dailyRentalRate, 0);
  assert.equal(updated.genreId, undefined);
  assert.equal(updated.name, undefined);
  assert.deepEqual(Movie.findByIdAndUpdate.mock.calls[0].arguments[1].$set, {
    title: "Updated Movie",
    genre: { _id: genres[1]._id, name: genres[1].name },
    numberInStock: undefined,
    dailyRentalRate: 0,
  });
  assert.deepEqual(await (await request("GET", `/api/movies/${id}`)).json(), updated);

  const deletion = await request("DELETE", `/api/movies/${id}`);
  assert.equal(deletion.status, 200);
  assert.deepEqual(await deletion.json(), updated);
  assert.equal(store.size, 1);
  assert.equal((await request("GET", `/api/movies/${id}`)).status, 404);
});

test("Movie HTTP currently rejects stock writes and cannot create without stock (mocked model)", async (t) => {
  const { request, store, payload } = await startMockApp(t);
  const id = store.keys().next().value;
  for (const method of ["POST", "PUT"]) {
    const response = await request(method,
      method === "POST" ? "/api/movies" : `/api/movies/${id}`,
      { ...payload, numberInStock: 10 });
    assert.equal(response.status, 400);
    assert.equal(await response.text(), '"numberInStock" is not allowed');
  }
  assert.equal(Genre.findById.mock.callCount(), 0);
  assert.equal(Movie.create.mock.callCount(), 0);
  assert.equal(Movie.findByIdAndUpdate.mock.callCount(), 0);

  // Joi accepts the remaining fields, but the real document schema requires stock.
  const response = await request("POST", "/api/movies", payload);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /numberInStock.*required/);
  assert.equal(Movie.create.mock.callCount(), 1);
  assert.equal(store.size, 2);
});

test("Movie HTTP validation rejects invalid writes before database calls (mocked model)", async (t) => {
  const { request, store, payload } = await startMockApp(t);
  const id = store.keys().next().value;
  const invalidBodies = [undefined, {}, [],
    { ...payload, title: undefined }, { ...payload, title: "abcd" },
    { ...payload, title: "    " }, { ...payload, title: "x".repeat(256) },
    { ...payload, title: 12345 }, { ...payload, genreId: undefined },
    { ...payload, genreId: "invalid" }, { ...payload, genreId: "z".repeat(24) },
    { ...payload, numberInStock: 0 }, { ...payload, numberInStock: -1 },
    { ...payload, numberInStock: 256 }, { ...payload, numberInStock: 1.5 },
    { ...payload, dailyRentalRate: undefined }, { ...payload, dailyRentalRate: -1 },
    { ...payload, dailyRentalRate: 256 }, { ...payload, dailyRentalRate: null },
    { ...payload, extra: true }];

  for (const method of ["POST", "PUT"]) {
    for (const [index, body] of invalidBodies.entries()) {
      await t.test(`${method} rejects invalid body ${index + 1}`, async () => {
        const response = await request(method,
          method === "POST" ? "/api/movies" : `/api/movies/${id}`, body);
        assert.equal(response.status, 400);
        assert.ok((await response.text()).length > 0);
        assert.equal(store.size, 2);
      });
    }
  }
  assert.equal(Genre.findById.mock.callCount(), 0);
  assert.equal(Movie.create.mock.callCount(), 0);
  assert.equal(Movie.findByIdAndUpdate.mock.callCount(), 0);
});

test("Movie HTTP rejects unknown genres without saving (mocked model)", async (t) => {
  const { request, store, payload } = await startMockApp(t);
  const id = store.keys().next().value;
  const genreId = new mongoose.Types.ObjectId().toHexString();

  for (const method of ["POST", "PUT"]) {
    const response = await request(method,
      method === "POST" ? "/api/movies" : `/api/movies/${id}`, { ...payload, genreId });
    assert.equal(response.status, 400);
    assert.equal(await response.text(), "Invalid Genre Id");
  }
  assert.equal(Movie.create.mock.callCount(), 0);
  assert.equal(Movie.findByIdAndUpdate.mock.callCount(), 0);
  assert.equal(store.size, 2);
});

test("Movie HTTP rejects malformed and missing movie IDs (mocked model)", async (t) => {
  const { request, store, payload } = await startMockApp(t);
  const missingId = new mongoose.Types.ObjectId().toHexString();
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const id of ["invalid", "1", "0123456789ab", "z".repeat(24), missingId]) {
      const response = await request(method, `/api/movies/${id}`,
        method === "PUT" ? payload : undefined);
      assert.equal(response.status, 404);
      assert.equal(await response.text(), "Movie not found");
      assert.equal(store.size, 2);
    }
  }
  for (const operation of [Movie.findById, Movie.findByIdAndUpdate, Movie.findByIdAndDelete]) {
    assert.equal(operation.mock.callCount(), 1);
    assert.equal(operation.mock.calls[0].arguments[0], missingId);
  }
});

test("Movie HTTP forwards database errors to the existing error handler (mocked model)", async (t) => {
  const { request, store, payload } = await startMockApp(t);
  const id = store.keys().next().value;
  t.mock.method(winston, "error", () => {});
  const fail = async () => { throw new Error("Private database details"); };

  for (const [model, operation, method, endpoint] of [
    [Movie, "find", "GET", "/api/movies"],
    [Movie, "findById", "GET", `/api/movies/${id}`],
    [Genre, "findById", "POST", "/api/movies"],
    [Genre, "findById", "PUT", `/api/movies/${id}`],
    [Movie, "create", "POST", "/api/movies"],
    [Movie, "findByIdAndUpdate", "PUT", `/api/movies/${id}`],
    [Movie, "findByIdAndDelete", "DELETE", `/api/movies/${id}`],
  ]) {
    model[operation].mock.mockImplementationOnce(operation === "find" ? () => ({ sort: fail }) : fail);
    const response = await request(method, endpoint,
      ["POST", "PUT"].includes(method) ? payload : undefined);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "An unexpected error occurred");
    assert.equal(store.size, 2);
  }
});
