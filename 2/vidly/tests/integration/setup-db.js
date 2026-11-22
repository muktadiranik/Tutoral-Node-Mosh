const { randomUUID } = require("node:crypto");
const config = require("config");
const mongoose = require("mongoose");

// Every suite gets its own disposable database, even in watch mode.
const databaseName = `vidly_integration_test_${randomUUID().replaceAll("-", "")}`;
const uri = process.env.VIDLY_TEST_MONGODB_URI || config.get("database");

function assertTestDatabase() {
  if (process.env.NODE_ENV !== "test" ||
      mongoose.connection.name !== databaseName ||
      !databaseName.startsWith("vidly_integration_test_")) {
    throw new Error("Refusing to clean a database not owned by this test suite.");
  }
}

beforeAll(async () => {
  try {
    // dbName overrides any database in the URI, including development names.
    await mongoose.connect(uri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
  } catch (error) {
    throw new Error(
      "Cannot connect to MongoDB for integration tests. Start MongoDB or set " +
      "VIDLY_TEST_MONGODB_URI to a test MongoDB server.",
      { cause: error },
    );
  }

  assertTestDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

beforeEach(async () => {
  assertTestDatabase();
  // Preserve indexes between tests (in particular the unique user-email index).
  await Promise.all(Object.values(mongoose.connection.collections)
    .map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      assertTestDatabase();
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
  }
});
