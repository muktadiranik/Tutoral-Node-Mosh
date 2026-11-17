const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { Rental } = require("../vidly/models/rental");
const { Customer } = require("../vidly/models/customer");
const { Movie } = require("../vidly/models/movie");
const rentals = require("../vidly/data/rentals");
const sampleCustomers = require("../vidly/data/customers");
const sampleMovies = require("../vidly/data/movies");

// Exercise the real schema while mocking database reads and inserts.
function mockDatabase(t) {
  const customers = sampleCustomers.map((data) => new Customer(data));
  const movies = sampleMovies.map(({ genreName, ...data }) => new Movie({
    ...data, genre: { name: genreName },
  }));
  const state = {
    stock: new Map(movies.map((movie) => [String(movie._id), movie.numberInStock])),
    rentals: [], operations: [],
  };
  t.mock.method(mongoose, "connect", async () => {
    state.operations.push("connect");
    return mongoose;
  });
  t.mock.method(mongoose, "disconnect", async () => { state.operations.push("disconnect"); });
  t.mock.method(mongoose.connection, "transaction", () => assert.fail("Seeding must work without transactions"));
  t.mock.method(Movie, "updateOne", () => assert.fail("Seeding must not change stock"));
  t.mock.method(Customer, "find", async (filter) => {
    state.operations.push("customers");
    assert.deepEqual(filter, {
      phone: { $in: [...new Set(rentals.map(({ phone }) => phone))] },
    });
    return [...customers].reverse();
  });
  t.mock.method(Movie, "find", async (filter) => {
    state.operations.push("movies");
    assert.deepEqual(filter, {
      title: { $in: [...new Set(rentals.map(({ movie }) => movie.title))] },
    });
    return [...movies].reverse();
  });
  t.mock.method(Rental, "insertMany", async (documents, options) => {
    assert.equal(options, undefined, "Inserts must not require a transaction session");
    assert.equal(documents.length, rentals.length);
    const result = [];
    for (const [index, document] of documents.entries()) {
      const sample = rentals[index];
      const customer = customers.find(({ phone }) => phone === sample.phone);
      const movie = movies.find(({ title }) => title === sample.movie.title);
      assert.deepEqual(document, {
        customer: customer.name, isGold: customer.isGold, phone: customer.phone,
        movie: { _id: movie._id, title: movie.title, dailyRentalRate: movie.dailyRentalRate },
        rentalFee: 0,
      });
      const rental = new Rental(document);
      await rental.validate();
      assert.equal(rental.dateReturned, null);
      assert.ok(rental.dateOut instanceof Date);
      assert.ok(rental._id instanceof mongoose.Types.ObjectId);
      result.push(rental);
    }
    state.rentals.push(...result);
    state.operations.push("insert");
    return result;
  });
  const log = t.mock.method(console, "log", () => {});
  return { customers, movies, state, log };
}

test("Importing the rental seed does not connect, query, or write", (t) => {
  t.mock.method(mongoose, "connect", () => assert.fail("Import must not connect"));
  t.mock.method(mongoose.connection, "transaction", () => assert.fail("Import must not start a transaction"));
  t.mock.method(Customer, "find", () => assert.fail("Import must not query"));
  t.mock.method(Movie, "find", () => assert.fail("Import must not query"));
  t.mock.method(Movie, "updateOne", () => assert.fail("Import must not update stock"));
  t.mock.method(Rental, "insertMany", () => assert.fail("Import must not seed"));

  const seed = require("../vidly/seed-rentals");
  assert.equal(typeof seed, "function");
  assert.equal(mongoose.connection.readyState, 0);
});

test("Sample rentals match the rental model and reference existing fixtures", async () => {
  assert.equal(rentals.length, 10);
  for (const sample of rentals) {
    assert.deepEqual(Object.keys(sample).sort(), ["customer", "isGold", "movie", "phone", "rentalFee"]);
    assert.deepEqual(Object.keys(sample.movie).sort(), ["dailyRentalRate", "title"]);
    const customer = sampleCustomers.find(({ phone }) => phone === sample.phone);
    const movie = sampleMovies.find(({ title }) => title === sample.movie.title);
    assert.ok(customer);
    assert.ok(movie);
    assert.equal(sample.customer, customer.name);
    assert.equal(sample.isGold, customer.isGold);
    assert.equal(sample.movie.dailyRentalRate, movie.dailyRentalRate);
    assert.equal(sample.rentalFee, 0);

    const rental = new Rental(sample);
    await rental.validate();
    assert.equal(rental.customer, sample.customer);
    assert.equal(rental.phone, sample.phone);
    assert.equal(rental.movie.title, sample.movie.title);
    assert.equal(rental.dateReturned, null);
    assert.ok(rental.dateOut instanceof Date);
  }
});

test("Rental seeding inserts stored snapshots without transactions or stock changes (mocked database)", async (t) => {
  const { state, movies, log } = mockDatabase(t);
  const originalData = JSON.stringify(rentals);
  await require("../vidly/seed-rentals")();

  assert.equal(mongoose.connect.mock.calls[0].arguments[0],
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises");
  assert.equal(state.rentals.length, 10);
  for (const movie of movies) {
    assert.equal(state.stock.get(String(movie._id)), movie.numberInStock);
  }
  assert.deepEqual(state.operations, ["connect", "customers", "movies", "insert", "disconnect"]);
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[0], "Created 10 rentals");
  assert.equal(JSON.stringify(rentals), originalData);
});

test("Rental seeding still uses current database snapshots rather than fixture values (mocked database)", async (t) => {
  const { customers, movies, state } = mockDatabase(t);
  customers[0].name = "Updated Customer";
  customers[0].isGold = false;
  movies[0].dailyRentalRate = 4.75;
  await require("../vidly/seed-rentals")();

  const rental = state.rentals[0];
  assert.equal(rental.customer, "Updated Customer");
  assert.equal(rental.isGold, false);
  assert.equal(rental.movie.dailyRentalRate, 4.75);
  assert.equal(rentals[0].customer, "Alex Morgan");
  assert.equal(rentals[0].isGold, true);
  assert.equal(rentals[0].movie.dailyRentalRate, 2.5);
});

test("Rental seeding adds another batch without consuming stock on rerun (mocked database)", async (t) => {
  const { state, movies } = mockDatabase(t);
  const seed = require("../vidly/seed-rentals");
  await seed();
  await seed();
  assert.equal(state.rentals.length, 20);
  assert.equal(new Set(state.rentals.map(({ _id }) => String(_id))).size, 20);
  for (const movie of movies) {
    assert.equal(state.stock.get(String(movie._id)), movie.numberInStock);
  }
  assert.equal(mongoose.disconnect.mock.callCount(), 2);
});

test("Rental seeding reports missing customers or movies before writes (mocked database)", async (t) => {
  const { customers, movies, state, log } = mockDatabase(t);
  const stock = new Map(state.stock);
  const missingPhone = customers[0].phone;
  Customer.find.mock.mockImplementationOnce(async () => customers.slice(1));
  const seed = require("../vidly/seed-rentals");
  await assert.rejects(seed(), (err) =>
    err.message.includes(missingPhone) && err.message.includes("npm run seed:customers"));

  Movie.find.mock.mockImplementationOnce(async () => movies.slice(1));
  await assert.rejects(seed(), /Missing movies: The Matrix\. Run npm run seed:movies/);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(Rental.insertMany.mock.callCount(), 0);
  assert.deepEqual(state.stock, stock);
  assert.equal(state.rentals.length, 0);
  assert.equal(mongoose.disconnect.mock.callCount(), 2);
  assert.equal(log.mock.callCount(), 0);
});

test("Rental sample seeding works even when a movie is out of stock (mocked database)", async (t) => {
  const { movies, state } = mockDatabase(t);
  movies.at(-1).numberInStock = 0;
  state.stock.set(String(movies.at(-1)._id), 0);
  const stock = new Map(state.stock);
  await require("../vidly/seed-rentals")();
  assert.deepEqual(state.stock, stock);
  assert.equal(state.rentals.length, 10);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
});

test("Rental seeding disconnects and propagates query, validation, and insertion failures (mocked database)", async (t) => {
  const { customers, state, log } = mockDatabase(t);
  const stock = new Map(state.stock);
  const seed = require("../vidly/seed-rentals");
  const failure = new Error("Database operation failed");
  const fail = async () => { throw failure; };
  for (const [model, operation] of [
    [Customer, "find"], [Movie, "find"], [Rental, "insertMany"],
  ]) {
    model[operation].mock.mockImplementationOnce(fail);
    await assert.rejects(seed(), (err) => err === failure);
    assert.deepEqual(state.stock, stock);
    assert.equal(state.rentals.length, 0);
  }
  // Keep the phone lookup key intact and trigger actual rental validation.
  customers[0].name = "bad";
  await assert.rejects(seed(), (err) => err instanceof mongoose.Error.ValidationError);
  assert.deepEqual(state.stock, stock);
  assert.equal(state.rentals.length, 0);
  assert.equal(mongoose.disconnect.mock.callCount(), 4);
  assert.equal(log.mock.callCount(), 0);
});

test("Rental seeding disconnects without querying or inserting after connection failure", async (t) => {
  const { state, log } = mockDatabase(t);
  const failure = new Error("Connection failed");
  mongoose.connect.mock.mockImplementationOnce(async () => { throw failure; });
  const seed = require("../vidly/seed-rentals");
  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(mongoose.connection.transaction.mock.callCount(), 0);

  assert.equal(Customer.find.mock.callCount(), 0);
  assert.equal(Movie.find.mock.callCount(), 0);
  assert.equal(Movie.updateOne.mock.callCount(), 0);
  assert.equal(Rental.insertMany.mock.callCount(), 0);
  assert.equal(state.rentals.length, 0);
  assert.equal(mongoose.disconnect.mock.callCount(), 1);
  assert.equal(log.mock.callCount(), 0);
});
