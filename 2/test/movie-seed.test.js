const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { Movie } = require("../vidly/models/movie");
const Genre = require("../vidly/models/genre");
const movies = require("../vidly/data/movies");
const sampleGenres = require("../vidly/data/genres");

test("Importing the movie seed does not connect, query, or insert documents", (t) => {
  t.mock.method(mongoose, "connect", () => assert.fail("Import must not connect"));
  t.mock.method(Genre, "find", () => assert.fail("Import must not query"));
  t.mock.method(Movie, "insertMany", () => assert.fail("Import must not seed"));

  const seed = require("../vidly/seed-movies");
  assert.equal(typeof seed, "function");
  assert.equal(mongoose.connection.readyState, 0);
});

test("Sample movies match sample genres and pass the real schema offline", async () => {
  assert.equal(movies.length, 10);
  assert.equal(new Set(movies.map(({ title }) => title)).size, movies.length);
  const genres = new Map(sampleGenres.map(({ name }) => [name, new Genre({ name })]));

  for (const { title, genreName, numberInStock, dailyRentalRate } of movies) {
    const genre = genres.get(genreName);
    assert.ok(genre, `Sample genre must exist: ${genreName}`);
    const movie = new Movie({
      title, genre: { _id: genre._id, name: genre.name }, numberInStock, dailyRentalRate,
    });
    await movie.validate();
    assert.equal(movie.title, title);
    assert.equal(movie.genre.name, genreName);
    assert.ok(movie.genre._id.equals(genre._id));
    assert.ok(movie._id instanceof mongoose.Types.ObjectId);
  }
});

test("Movie seeding embeds stored genres, inserts sample fields, and disconnects (mocked database)", async (t) => {
  const operations = [];
  const genres = sampleGenres.map(({ name }) => new Genre({ name }));
  const connect = t.mock.method(mongoose, "connect", async () => {
    operations.push("connect");
    return mongoose;
  });
  t.mock.method(mongoose, "disconnect", async () => { operations.push("disconnect"); });
  t.mock.method(Genre, "find", async (filter) => {
    operations.push("find");
    assert.deepEqual(filter, {
      name: { $in: [...new Set(movies.map(({ genreName }) => genreName))] },
    });
    // Lookup must use names, not the query result order or sample numeric IDs.
    return [...genres].reverse();
  });
  const insert = t.mock.method(Movie, "insertMany", async (documents) => {
    operations.push("insert");
    assert.equal(documents.length, movies.length);
    for (const [index, document] of documents.entries()) {
      const { title, genreName, numberInStock, dailyRentalRate } = movies[index];
      const genre = genres.find(({ name }) => name === genreName);
      assert.deepEqual(document, {
        title, genre: { _id: genre._id, name: genre.name }, numberInStock, dailyRentalRate,
      });
      assert.notEqual(document, movies[index]);
      await new Movie(document).validate();
    }
    return documents;
  });
  const log = t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-movies");
  const originalData = JSON.stringify(movies);

  await seed();
  assert.deepEqual(operations, ["connect", "find", "insert", "disconnect"]);
  assert.equal(connect.mock.calls[0].arguments[0],
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises");
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[0], "Created 10 movies");
  assert.equal(JSON.stringify(movies), originalData);
});

test("Movie seeding rejects missing genres before inserting anything (mocked database)", async (t) => {
  t.mock.method(mongoose, "connect", async () => mongoose);
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const find = t.mock.method(Genre, "find", async () => []);
  t.mock.method(Movie, "insertMany", () => assert.fail("Missing genres must prevent all inserts"));
  const log = t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-movies");

  await assert.rejects(seed(), /Missing genres: .*Sci-Fi.*Run npm run seed:vidly/);
  find.mock.mockImplementation(async () =>
    sampleGenres.filter(({ name }) => name !== "Comedy").map(({ name }) => new Genre({ name })));
  await assert.rejects(seed(), /Missing genres: Comedy\. Run npm run seed:vidly/);
  assert.equal(disconnect.mock.callCount(), 2);
  assert.equal(log.mock.callCount(), 0);
});

test("Movie seeding disconnects and propagates lookup errors (mocked database)", async (t) => {
  t.mock.method(mongoose, "connect", async () => mongoose);
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const failure = new Error("Genre lookup failed");
  t.mock.method(Genre, "find", async () => { throw failure; });
  t.mock.method(Movie, "insertMany", () => assert.fail("Failed lookup must prevent inserts"));
  const seed = require("../vidly/seed-movies");

  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(disconnect.mock.callCount(), 1);
});

test("Movie seeding disconnects and propagates insertion errors (mocked database)", async (t) => {
  t.mock.method(mongoose, "connect", async () => mongoose);
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  t.mock.method(Genre, "find", async () => sampleGenres.map(({ name }) => new Genre({ name })));
  const failure = new Error("Movie insertion failed");
  t.mock.method(Movie, "insertMany", async () => { throw failure; });
  const log = t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-movies");

  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(disconnect.mock.callCount(), 1);
  assert.equal(log.mock.callCount(), 0);
});

test("Movie seeding does not query or insert after a connection failure (mocked database)", async (t) => {
  const failure = new Error("Movie connection failed");
  t.mock.method(mongoose, "connect", async () => { throw failure; });
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  t.mock.method(Genre, "find", () => assert.fail("Must connect before querying"));
  t.mock.method(Movie, "insertMany", () => assert.fail("Must connect before inserting"));
  const seed = require("../vidly/seed-movies");

  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(disconnect.mock.callCount(), 1);
});
