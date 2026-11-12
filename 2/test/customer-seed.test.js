const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const Customer = require("../vidly/models/customer");
const customers = require("../vidly/data/customers");

test("Importing the customer seed does not connect or insert documents", (t) => {
  t.mock.method(mongoose, "connect", () => assert.fail("Import must not connect"));
  t.mock.method(Customer, "insertMany", () => assert.fail("Import must not seed"));

  const seed = require("../vidly/seed-customers");
  assert.equal(typeof seed, "function");
  assert.equal(mongoose.connection.readyState, 0);
});

test("Sample customers pass the real Mongoose schema without a database", async () => {
  assert.equal(customers.length, 10);
  assert.equal(new Set(customers.map(({ phone }) => phone)).size, customers.length);
  assert.ok(customers.some(({ isGold }) => isGold));
  assert.ok(customers.some(({ isGold }) => !isGold));

  for (const data of customers) {
    assert.deepEqual(Object.keys(data).sort(), ["isGold", "name", "phone"]);
    const customer = new Customer(data);
    await customer.validate();
    assert.equal(customer.name, data.name);
    assert.equal(customer.phone, data.phone);
    assert.equal(customer.isGold, data.isGold);
    assert.ok(customer._id instanceof mongoose.Types.ObjectId);
  }
});

test("Customer seeding inserts the sample fields and disconnects (mocked database)", async (t) => {
  const operations = [];
  const connect = t.mock.method(mongoose, "connect", async () => {
    operations.push("connect");
    return mongoose;
  });
  t.mock.method(mongoose, "disconnect", async () => { operations.push("disconnect"); });
  const insert = t.mock.method(Customer, "insertMany", async (documents) => {
    operations.push("insert");
    assert.deepEqual(documents, customers);
    assert.notEqual(documents, customers);
    for (const [index, document] of documents.entries()) {
      assert.notEqual(document, customers[index]);
      await new Customer(document).validate();
    }
    return documents;
  });
  const log = t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-customers");

  await seed();
  assert.deepEqual(operations, ["connect", "insert", "disconnect"]);
  assert.equal(connect.mock.calls[0].arguments[0],
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises");
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[0], "Created 10 customers");
});

test("Customer seeding disconnects and propagates insertion errors (mocked database)", async (t) => {
  t.mock.method(mongoose, "connect", async () => mongoose);
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  const failure = new Error("Customer insertion failed");
  t.mock.method(Customer, "insertMany", async () => { throw failure; });
  const log = t.mock.method(console, "log", () => {});
  const seed = require("../vidly/seed-customers");

  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(disconnect.mock.callCount(), 1);
  assert.equal(log.mock.callCount(), 0);
});

test("Customer seeding does not insert after a connection failure (mocked database)", async (t) => {
  const failure = new Error("Customer connection failed");
  t.mock.method(mongoose, "connect", async () => { throw failure; });
  const disconnect = t.mock.method(mongoose, "disconnect", async () => {});
  t.mock.method(Customer, "insertMany", () => assert.fail("Must connect before inserting"));
  const seed = require("../vidly/seed-customers");

  await assert.rejects(seed(), (err) => err === failure);
  assert.equal(disconnect.mock.callCount(), 1);
});
