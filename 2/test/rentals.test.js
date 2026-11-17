const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const mongoose = require("mongoose");
const { Rental, validate } = require("../vidly/models/rental");
const { Customer } = require("../vidly/models/customer");
const { Movie } = require("../vidly/models/movie");

// Exercise HTTP handlers and real schemas without connecting to MongoDB.
// Transaction rollback/retry behavior below is simulated, not live evidence.
async function startMockApp(t) {
  const customer = new Customer({ name: "Alex Morgan", isGold: true, phone: "+1-202-555-0101" });
  const movie = new Movie({
    title: "The Matrix", genre: { name: "Sci-Fi" }, numberInStock: 2, dailyRentalRate: 2.5,
  });
  const data = {
    customer: customer.name, isGold: customer.isGold, phone: customer.phone,
    movie: { _id: movie._id, title: movie.title, dailyRentalRate: movie.dailyRentalRate },
    rentalFee: 0,
  };
  const rentals = new Map(["2026-01-01", "2026-01-02"].map((date) => {
    const rental = new Rental({ ...data, dateOut: new Date(date) });
    return [String(rental._id), rental];
  }));
  const state = { stock: 2, rentals, session: null, operations: [] };
  const assertSession = (session) => {
    assert.ok(state.session, "Database writes must be inside the transaction");
    assert.equal(session, state.session);
  };
  const runTransaction = async (callback, options) => {
    assert.deepEqual(options, { readPreference: "primary" });
    const snapshot = { stock: state.stock, rentals: new Map(state.rentals) };
    state.session = {};
    state.operations.push("begin");
    try {
      const result = await callback(state.session);
      state.operations.push("commit");
      return result;
    } catch (err) {
      state.stock = snapshot.stock;
      state.rentals = snapshot.rentals;
      state.operations.push("abort");
      throw err;
    } finally {
      state.session = null;
    }
  };
  t.mock.method(mongoose.connection, "transaction", runTransaction);
  t.mock.method(Customer, "findById", (id) => ({
    session: async (session) => {
      assertSession(session);
      return String(id).toLowerCase() === String(customer._id) ? customer : null;
    },
  }));
  t.mock.method(Movie, "findById", (id) => ({
    session: async (session) => {
      assertSession(session);
      return String(id).toLowerCase() === String(movie._id) ? movie : null;
    },
  }));
  t.mock.method(Movie, "updateOne", async (filter, update, options) => {
    assertSession(options.session);
    assert.deepEqual(filter, { _id: movie._id, numberInStock: { $gte: 1 } });
    assert.deepEqual(update, { $inc: { numberInStock: -1 } });
    if (state.stock < 1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    state.stock--;
    state.operations.push("decrement");
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(Rental.prototype, "save", async function (options) {
    assertSession(options.session);
    await this.validate();
    state.rentals.set(String(this._id), this);
    state.operations.push("save");
    return this;
  });
  t.mock.method(Rental, "find", () => ({
    sort: async (sort) => {
      assert.deepEqual(sort, { dateOut: -1 });
      return [...state.rentals.values()].sort((a, b) => b.dateOut - a.dateOut);
    },
  }));
  t.mock.method(Rental, "findById", async (id) => state.rentals.get(String(id)) || null);

  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");
  const request = (method, endpoint = "/api/rentals", body) => fetch(
    `http://127.0.0.1:${server.address().port}${endpoint}`,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );
  const payload = { customerId: String(customer._id), movieId: String(movie._id) };
  return { request, state, customer, movie, payload, runTransaction };
}

test("Rental validation requires only valid customer and movie IDs", () => {
  const payload = {
    customerId: new mongoose.Types.ObjectId().toHexString(),
    movieId: new mongoose.Types.ObjectId().toHexString(),
  };
  assert.equal(validate(payload).error, undefined);
  assert.equal(validate({
    customerId: payload.customerId.toUpperCase(), movieId: payload.movieId.toUpperCase(),
  }).error, undefined);
  for (const body of [undefined, null, [], {},
    { ...payload, customerId: undefined }, { ...payload, movieId: undefined },
    { ...payload, customerId: "invalid" }, { ...payload, movieId: "z".repeat(24) },
    { ...payload, rentalFee: -1 }]) {
    assert.ok(validate(body).error);
  }
});

test("Rental HTTP lists newest first and fetches by ID (mocked database)", async (t) => {
  const { request } = await startMockApp(t);
  const response = await request("GET");
  assert.equal(response.status, 200);
  const rentals = await response.json();
  assert.equal(rentals.length, 2);
  assert.ok(new Date(rentals[0].dateOut) > new Date(rentals[1].dateOut));
  const rental = await request("GET", `/api/rentals/${rentals[0]._id}`);
  assert.equal(rental.status, 200);
  assert.deepEqual(await rental.json(), rentals[0]);
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);
});

test("Rental HTTP creates schema-compatible snapshots and decrements stock in one transaction (mocked database)", async (t) => {
  const { request, state, customer, movie, payload } = await startMockApp(t);
  const before = Date.now();
  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 201);
  const rental = await response.json();
  assert.equal(rental.customer, customer.name);
  assert.equal(rental.isGold, true);
  assert.equal(rental.phone, customer.phone);
  assert.deepEqual(rental.movie, {
    _id: String(movie._id), title: movie.title, dailyRentalRate: movie.dailyRentalRate,
  });
  assert.equal(rental.rentalFee, 0);
  assert.equal(rental.dateReturned, null);
  assert.ok(Date.parse(rental.dateOut) >= before);
  assert.ok(Date.parse(rental.dateOut) <= Date.now());
  assert.equal(rental.customerId, undefined);
  assert.equal(rental.movieId, undefined);
  assert.equal(state.stock, 1);
  assert.equal(state.rentals.size, 3);
  assert.deepEqual(state.operations, ["begin", "decrement", "save", "commit"]);
  assert.equal(state.session, null);
  assert.deepEqual(await (await request("GET", `/api/rentals/${rental._id}`)).json(), rental);

  customer.name = "Jamie Taylor";
  movie.title = "Updated Movie";
  assert.equal(state.rentals.get(rental._id).customer, "Alex Morgan");
  assert.equal(state.rentals.get(rental._id).movie.title, "The Matrix");
});

test("Rental HTTP rejects invalid bodies before database calls (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  for (const body of [undefined, {}, [],
    { ...payload, customerId: undefined }, { ...payload, movieId: undefined },
    { ...payload, customerId: "invalid" }, { ...payload, movieId: "invalid" },
    { ...payload, customerId: 123 }, { ...payload, movieId: "z".repeat(24) },
    { ...payload, rentalFee: 99 }, { ...payload, dateOut: "2020-01-01" }]) {
    const response = await request("POST", "/api/rentals", body);
    assert.equal(response.status, 400);
    assert.ok((await response.text()).length > 0);
  }
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);
  assert.equal(Customer.findById.mock.callCount(), 0);
  assert.equal(Movie.findById.mock.callCount(), 0);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(Rental.prototype.save.mock.callCount(), 0);
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
});

test("Rental HTTP returns 404 for malformed and missing IDs (mocked database)", async (t) => {
  const { request } = await startMockApp(t);
  for (const id of ["invalid", "1", "0123456789ab", "z".repeat(24),
    new mongoose.Types.ObjectId().toHexString()]) {
    const response = await request("GET", `/api/rentals/${id}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Rental not found");
  }
  assert.equal(Rental.findById.mock.callCount(), 1);
});

test("Rental HTTP rejects missing customers/movies without writes (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  for (const [field, message] of [["customerId", "Invalid Customer Id"], ["movieId", "Invalid Movie Id"]]) {
    const response = await request("POST", "/api/rentals", {
      ...payload, [field]: new mongoose.Types.ObjectId().toHexString(),
    });
    assert.equal(response.status, 400);
    assert.equal(await response.text(), message);
  }
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(Rental.prototype.save.mock.callCount(), 0);
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
  assert.deepEqual(state.operations, ["begin", "abort", "begin", "abort"]);
});

test("Rental HTTP refuses another rental after the last copy is rented (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  state.stock = 1;
  assert.equal((await request("POST", "/api/rentals", payload)).status, 201);
  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Movie is not in stock");
  assert.equal(state.stock, 0);
  assert.equal(state.rentals.size, 3);
  assert.equal(Rental.prototype.save.mock.callCount(), 1);
});

test("Rental HTTP aborts stock changes when validation or saving fails (mocked transaction)", async (t) => {
  const { request, state, customer, payload } = await startMockApp(t);
  const log = t.mock.method(console, "error", () => {});
  customer.phone = "bad";
  let response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /phone/);
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);

  customer.phone = "+1-202-555-0101";
  Rental.prototype.save.mock.mockImplementationOnce(async () => {
    throw new Error("Private save details");
  });
  response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "An unexpected error occurred");
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(state.operations, ["begin", "decrement", "abort", "begin", "decrement", "abort"]);
});

test("Rental HTTP does not return success when committing fails (mocked transaction)", async (t) => {
  const { request, state, payload, runTransaction } = await startMockApp(t);
  t.mock.method(console, "error", () => {});
  mongoose.connection.transaction.mock.mockImplementationOnce((callback, options) =>
    runTransaction(async (session) => {
      await callback(session);
      throw new Error("Commit failed");
    }, options));

  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "An unexpected error occurred");
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
  assert.deepEqual(state.operations, ["begin", "decrement", "save", "abort"]);
});

test("Rental HTTP can retry the transaction callback without double-decrementing (mocked transaction)", async (t) => {
  const { request, state, payload, runTransaction } = await startMockApp(t);
  mongoose.connection.transaction.mock.mockImplementationOnce(async (callback, options) => {
    const retry = new Error("Simulated transient write conflict");
    await assert.rejects(runTransaction(async (session) => {
      await callback(session);
      throw retry;
    }, options), (err) => err === retry);
    return runTransaction(callback, options);
  });

  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 201);
  const rental = await response.json();
  assert.ok(state.rentals.has(rental._id));
  assert.equal(state.stock, 1);
  assert.equal(state.rentals.size, 3);
  assert.deepEqual(state.operations, [
    "begin", "decrement", "save", "abort", "begin", "decrement", "save", "commit",
  ]);
});

test("Rental HTTP forwards lookup, stock-update, and transaction errors safely (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  t.mock.method(console, "error", () => {});
  const fail = async () => { throw new Error("Private database details"); };

  for (const [model, operation, method, endpoint, implementation] of [
    [Rental, "find", "GET", "/api/rentals", () => ({ sort: fail })],
    [Rental, "findById", "GET", `/api/rentals/${new mongoose.Types.ObjectId()}`, fail],
    [Customer, "findById", "POST", "/api/rentals", () => ({ session: fail })],
    [Movie, "findById", "POST", "/api/rentals", () => ({ session: fail })],
    [Movie, "updateOne", "POST", "/api/rentals", fail],
    [mongoose.connection, "transaction", "POST", "/api/rentals", fail],
  ]) {
    model[operation].mock.mockImplementationOnce(implementation);
    const response = await request(method, endpoint, method === "POST" ? payload : undefined);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "An unexpected error occurred");
    assert.equal(state.stock, 2);
    assert.equal(state.rentals.size, 2);
  }
});
