const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const mongoose = require("mongoose");
const Customer = require("../vidly/models/customer");

// Test the real validation middleware without writing customer records to MongoDB.
async function startMockApp(t) {
  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");

  return (method, endpoint, body) => fetch(
    `http://127.0.0.1:${server.address().port}${endpoint}`,
    {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    },
  );
}

test("Customer POST and PUT accept all fields and normalize booleans (mocked model)", async (t) => {
  const request = await startMockApp(t);
  const id = new mongoose.Types.ObjectId().toHexString();
  const create = t.mock.method(Customer, "create", async (data) => ({ _id: id, ...data }));
  const update = t.mock.method(Customer, "findByIdAndUpdate", async (customerId, data) =>
    ({ _id: customerId, ...data.$set }));

  for (const method of ["POST", "PUT"]) {
    for (const [input, expected] of [["true", true], ["false", false],
      [true, true], [false, false], [undefined, false]]) {
      await t.test(`${method} handles isGold=${String(input)}`, async () => {
        const body = { name: "  Alex Morgan  ", isGold: input, phone: "  +1-202-555-0101  " };
        const endpoint = method === "POST" ? "/api/customers" : `/api/customers/${id}`;
        const response = await request(method, endpoint, body);
        assert.equal(response.status, method === "POST" ? 201 : 200);
        assert.deepEqual(await response.json(), {
          _id: id,
          name: "Alex Morgan",
          isGold: expected,
          phone: "+1-202-555-0101",
        });

        const call = (method === "POST" ? create : update).mock.calls.at(-1);
        const saved = method === "POST" ? call.arguments[0] : call.arguments[1].$set;
        assert.equal(typeof saved.isGold, "boolean");
        assert.equal(saved.isGold, expected);
      });
    }
  }
});

test("Customer POST and PUT reject invalid fields before database writes (mocked model)", async (t) => {
  const request = await startMockApp(t);
  const id = new mongoose.Types.ObjectId().toHexString();
  t.mock.method(Customer, "create", () => assert.fail("Invalid input must not be saved"));
  t.mock.method(Customer, "findByIdAndUpdate", () => assert.fail("Invalid input must not be saved"));
  const valid = { name: "Alex Morgan", phone: "+1-202-555-0101", isGold: true };
  const bodies = [undefined, {}, [],
    { ...valid, name: undefined }, { ...valid, name: "abcd" },
    { ...valid, name: "x".repeat(256) }, { ...valid, phone: undefined },
    { ...valid, phone: "1234" }, { ...valid, phone: "x".repeat(256) },
    { ...valid, phone: 12345 }, { ...valid, isGold: "not-a-boolean" },
    { ...valid, isGold: null }, { ...valid, extra: true }];

  for (const method of ["POST", "PUT"]) {
    for (const [index, body] of bodies.entries()) {
      await t.test(`${method} rejects invalid body ${index + 1}`, async () => {
        const endpoint = method === "POST" ? "/api/customers" : `/api/customers/${id}`;
        const response = await request(method, endpoint, body);
        assert.equal(response.status, 400);
        assert.ok((await response.text()).length > 0);
      });
    }
  }
});
