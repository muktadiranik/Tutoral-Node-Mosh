const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const bcrypt = require("bcrypt");
const { User } = require("../vidly/models/user");

// Exercise middleware and HTTP handlers without creating real user records.
async function startMockApp(t) {
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User.prototype, "save", async function () {
    await this.validate();
    return this;
  });
  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");

  return (body) => fetch(`http://127.0.0.1:${server.address().port}/api/users`, {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

const payload = { name: "Mosh Hamedani", email: "mosh@example.com", password: "test-password" };

test("User schema keeps emails unique without indexing passwords", () => {
  assert.equal(User.schema.path("email").options.unique, true);
  assert.equal(User.schema.path("password").options.unique, undefined);
  assert.deepEqual(User.schema.indexes(), [[{ email: 1 }, { unique: true }]]);
});

test("User registration accepts the sample name and the one-character minimum (mocked database)", async (t) => {
  const request = await startMockApp(t);
  for (const name of ["Mosh", "M"]) {
    const response = await request({ ...payload, name });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).name, name);
  }
  assert.equal(User.prototype.save.mock.callCount(), 2);
});

test("User registration validates invalid bodies before database calls (mocked database)", async (t) => {
  const request = await startMockApp(t);
  for (const body of [undefined, {}, [],
    { ...payload, name: undefined }, { ...payload, name: "    " },
    { ...payload, name: "x".repeat(256) }, { ...payload, name: 12345 },
    { ...payload, email: undefined }, { ...payload, email: "invalid" },
    { ...payload, password: undefined }, { ...payload, password: "" },
    { ...payload, extra: true }]) {
    const response = await request(body);
    assert.equal(response.status, 400);
    assert.ok((await response.text()).length > 0);
  }
  assert.equal(User.findOne.mock.callCount(), 0);
  assert.equal(User.prototype.save.mock.callCount(), 0);
});

test("User registration runs validation middleware and uses normalized input (mocked database)", async (t) => {
  const request = await startMockApp(t);
  const response = await request({ ...payload, name: "  Mosh Hamedani  ", email: "  mosh@example.com  " });
  assert.equal(response.status, 200);
  const user = await response.json();
  assert.equal(user.name, payload.name);
  assert.equal(user.email, payload.email);
  assert.match(user._id, /^[a-f0-9]{24}$/);
  assert.deepEqual(Object.keys(user).sort(), ["_id", "email", "name"]);
  assert.equal(Object.hasOwn(user, "password"), false);
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { email: payload.email });
  assert.equal(User.prototype.save.mock.callCount(), 1);
});

test("User registration accepts different emails sharing a password (mocked database)", async (t) => {
  const request = await startMockApp(t);
  for (const email of [payload.email, "another@example.com"]) {
    const response = await request({ ...payload, email });
    assert.equal(response.status, 200);
    const user = await response.json();
    assert.equal(user.email, email);
    assert.equal(Object.hasOwn(user, "password"), false);
  }
  assert.equal(User.prototype.save.mock.callCount(), 2);
  for (const call of User.prototype.save.mock.calls) {
    assert.notEqual(call.this.password, payload.password);
    assert.equal(await bcrypt.compare(payload.password, call.this.password), true);
  }
});

test("User registration keeps duplicate-email handling after validation (mocked database)", async (t) => {
  const request = await startMockApp(t);
  User.findOne.mock.mockImplementationOnce(async () => new User(payload));
  const response = await request({ ...payload, email: "  mosh@example.com  " });
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "User already registered");
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { email: payload.email });
  assert.equal(User.prototype.save.mock.callCount(), 0);
});

test("User registration forwards database errors to the existing error handler (mocked database)", async (t) => {
  const request = await startMockApp(t);
  t.mock.method(console, "error", () => {});
  const fail = async () => { throw new Error("Private database details"); };
  for (const [model, method] of [[User, "findOne"], [User.prototype, "save"]]) {
    model[method].mock.mockImplementationOnce(fail);
    const response = await request(payload);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "An unexpected error occurred");
  }
});
