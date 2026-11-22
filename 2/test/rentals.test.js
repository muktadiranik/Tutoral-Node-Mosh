const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const mongoose = require("mongoose");
const winston = require("winston");
const { token } = require("../test-support/vidly");
const { Rental, validate } = require("../vidly/models/rental");
const { Customer } = require("../vidly/models/customer");
const { Movie } = require("../vidly/models/movie");

// Exercise HTTP handlers and real schemas without connecting to MongoDB.
// Stock updates and compensation below are simulated, not live evidence.
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
  const state = { stock: 2, rentals, operations: [] };
  t.mock.method(winston, "error", () => {});
  t.mock.method(mongoose.connection, "transaction", () => {
    throw new Error("Transactions are unavailable on standalone MongoDB");
  });
  t.mock.method(Customer, "findById", async (id) =>
    String(id).toLowerCase() === String(customer._id) ? customer : null);
  t.mock.method(Movie, "findById", async (id) =>
    String(id).toLowerCase() === String(movie._id) ? movie : null);
  t.mock.method(Movie, "updateOne", async (filter, update, options) => {
    assert.equal(options, undefined);
    if (update.$inc.numberInStock === 1) {
      assert.deepEqual(filter, { _id: movie._id });
      assert.deepEqual(update, { $inc: { numberInStock: 1 } });
      state.stock++;
      state.operations.push("restore");
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    }
    assert.deepEqual(filter, { _id: movie._id, numberInStock: { $gte: 1 } });
    assert.deepEqual(update, { $inc: { numberInStock: -1 } });
    if (state.stock < 1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    state.stock--;
    state.operations.push("decrement");
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(Rental.prototype, "save", async function (options) {
    assert.equal(options, undefined);
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
  const authToken = token();
  const request = (method, endpoint = "/api/rentals", body) => fetch(
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
  const payload = { customerId: String(customer._id), movieId: String(movie._id) };
  return { request, state, customer, movie, payload };
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

test("Rental HTTP creates snapshots and decrements stock without transactions (mocked database)", async (t) => {
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
  assert.deepEqual(state.operations, ["decrement", "save"]);
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);
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
  assert.deepEqual(state.operations, []);
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

test("Rental HTTP validates snapshots before changing stock (mocked database)", async (t) => {
  const { request, state, customer, payload } = await startMockApp(t);
  customer.phone = "bad";
  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /phone/);
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(Rental.prototype.save.mock.callCount(), 0);
  assert.deepEqual(state.operations, []);
});

test("Rental HTTP restores stock when saving fails (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  Rental.prototype.save.mock.mockImplementationOnce(async () => {
    throw new Error("Private save details");
  });
  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "An unexpected error occurred");
  assert.equal(state.stock, 2);
  assert.equal(state.rentals.size, 2);
  assert.equal(winston.error.mock.callCount(), 1);
  assert.deepEqual(state.operations, ["decrement", "restore"]);
});

test("Rental HTTP logs failed compensation and preserves the save error (mocked database)", async (t) => {
  const { request, state, movie, payload } = await startMockApp(t);
  const log = t.mock.method(console, "error", () => {});
  const saveError = new Error("Private save details");
  const restoreError = new Error("Private restore details");
  Rental.prototype.save.mock.mockImplementationOnce(async () => {
    throw saveError;
  });
  Movie.updateOne.mock.mockImplementationOnce(async () => {
    throw restoreError;
  }, 1);

  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "An unexpected error occurred");
  assert.equal(state.stock, 1);
  assert.equal(state.rentals.size, 2);
  assert.deepEqual(state.operations, ["decrement"]);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[1].movieId, String(movie._id));
  assert.equal(log.mock.calls[0].arguments[1].error, restoreError);
  assert.deepEqual(winston.error.mock.calls[0].arguments, [
    saveError.message, { stack: saveError.stack },
  ]);
});

test("Rental HTTP logs a missing movie during stock restoration (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  const log = t.mock.method(console, "error", () => {});
  Rental.prototype.save.mock.mockImplementationOnce(async () => {
    throw new Error("Private save details");
  });
  Movie.updateOne.mock.mockImplementationOnce(async () => ({
    acknowledged: true, matchedCount: 0, modifiedCount: 0,
  }), 1);

  const response = await request("POST", "/api/rentals", payload);
  assert.equal(response.status, 500);
  assert.equal(await response.text(), "An unexpected error occurred");
  assert.equal(state.stock, 1);
  assert.equal(state.rentals.size, 2);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(winston.error.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[1].error.message, /Movie not found/);
});

test("Rental HTTP guards the last copy across concurrent requests (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  state.stock = 1;
  const responses = await Promise.all([
    request("POST", "/api/rentals", payload),
    request("POST", "/api/rentals", payload),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 400]);
  for (const response of responses) {
    if (response.status === 201) await response.json();
    else assert.equal(await response.text(), "Movie is not in stock");
  }
  assert.equal(state.stock, 0);
  assert.equal(state.rentals.size, 3);
  assert.deepEqual(state.operations, ["decrement", "save"]);
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);
});

test("Rental HTTP forwards lookup and stock-update errors safely (mocked database)", async (t) => {
  const { request, state, payload } = await startMockApp(t);
  t.mock.method(console, "error", () => {});
  const fail = async () => { throw new Error("Private database details"); };

  for (const [model, operation, method, endpoint, implementation] of [
    [Rental, "find", "GET", "/api/rentals", () => ({ sort: fail })],
    [Rental, "findById", "GET", `/api/rentals/${new mongoose.Types.ObjectId()}`, fail],
    [Customer, "findById", "POST", "/api/rentals", fail],
    [Movie, "findById", "POST", "/api/rentals", fail],
    [Movie, "updateOne", "POST", "/api/rentals", fail],
  ]) {
    model[operation].mock.mockImplementationOnce(implementation);
    const response = await request(method, endpoint, method === "POST" ? payload : undefined);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "An unexpected error occurred");
    assert.equal(state.stock, 2);
    assert.equal(state.rentals.size, 2);
  }
});
