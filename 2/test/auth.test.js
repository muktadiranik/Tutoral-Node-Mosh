const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../vidly/models/user");

const jwtPrivateKey = "vidly-auth-tests-only-not-for-production";
process.env.vidly_jwtPrivateKey = jwtPrivateKey;

function assertAuthToken(token, userId) {
  const decoded = jwt.verify(token, jwtPrivateKey, { algorithms: ["HS256"] });
  assert.equal(decoded._id, String(userId));
  assert.deepEqual(Object.keys(decoded).sort(), ["_id", "iat"]);
}

// Exercise real HTTP handlers and bcrypt without connecting to MongoDB.
async function startMockApp(t) {
  t.mock.method(User, "findOne", async () => null);
  const app = require("../vidly");
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  }));
  await once(server, "listening");

  return (body, path = "/api/auth") => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

const payload = { email: "mosh@example.com", password: "test-password" };

test("Authentication validates bodies before querying users (mocked database)", async (t) => {
  const request = await startMockApp(t);
  for (const body of [undefined, {}, [],
    { ...payload, email: undefined }, { ...payload, email: "invalid" },
    { ...payload, email: "x".repeat(256) },
    { ...payload, password: undefined }, { ...payload, password: "" },
    { ...payload, password: "    " }, { ...payload, password: 123 },
    { ...payload, extra: true }]) {
    const response = await request(body);
    assert.equal(response.status, 400);
    assert.ok((await response.text()).length > 0);
  }
  assert.equal(User.findOne.mock.callCount(), 0);
});

test("Authentication rejects an unknown email without comparing passwords (mocked database)", async (t) => {
  const request = await startMockApp(t);
  t.mock.method(bcrypt, "compare", () => assert.fail("No password comparison without a user"));
  const response = await request(payload);
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Invalid email or password!");
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { email: payload.email });
  assert.equal(bcrypt.compare.mock.callCount(), 0);
});

test("Authentication awaits bcrypt and rejects a wrong password (mocked database, real bcrypt)", async (t) => {
  const request = await startMockApp(t);
  const password = await bcrypt.hash(payload.password, 4);
  User.findOne.mock.mockImplementationOnce(async () => ({ email: payload.email, password }));
  const response = await request({ ...payload, password: "wrong-password" });
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Invalid email or password!");
});

test("Authentication returns a signed JWT for a matching password hash (mocked database, real bcrypt)", async (t) => {
  const request = await startMockApp(t);
  const password = await bcrypt.hash(payload.password, 4);
  const userId = "507f1f77bcf86cd799439011";
  User.findOne.mock.mockImplementationOnce(async () => ({ _id: userId, email: payload.email, password }));
  const response = await request(payload);
  assert.equal(response.status, 200);
  assertAuthToken(await response.text(), userId);
});

test("Authentication uses validated and normalized input (mocked database, real bcrypt)", async (t) => {
  const request = await startMockApp(t);
  const password = await bcrypt.hash(payload.password, 4);
  const userId = "507f1f77bcf86cd799439011";
  User.findOne.mock.mockImplementationOnce(async () => ({ _id: userId, email: payload.email, password }));
  const response = await request({ email: "  mosh@example.com  ", password: "  test-password  " });
  assert.equal(response.status, 200);
  assertAuthToken(await response.text(), userId);
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { email: payload.email });
});

test("Registered password hashes work for login (mocked database, real bcrypt)", async (t) => {
  const request = await startMockApp(t);
  let savedUser;
  t.mock.method(User.prototype, "save", async function () {
    await this.validate();
    savedUser = this;
    return this;
  });
  const registration = await request({ name: "Mosh", ...payload }, "/api/users");
  assert.equal(registration.status, 200);
  assert.equal(Object.hasOwn(await registration.json(), "password"), false);
  assert.notEqual(savedUser.password, payload.password);
  User.findOne.mock.mockImplementationOnce(async () => savedUser);
  const login = await request(payload);
  assert.equal(login.status, 200);
  assertAuthToken(await login.text(), savedUser._id);
});

test("Authentication forwards lookup and comparison errors without leaking details (mocked database)", async (t) => {
  const request = await startMockApp(t);
  t.mock.method(console, "error", () => {});
  const fail = async () => { throw new Error("Private authentication details"); };
  User.findOne.mock.mockImplementationOnce(fail);
  const lookupFailure = await request(payload);
  assert.equal(lookupFailure.status, 500);
  assert.equal(await lookupFailure.text(), "An unexpected error occurred");

  User.findOne.mock.mockImplementationOnce(async () => ({ password: "stored-hash" }));
  t.mock.method(bcrypt, "compare", fail);
  const comparisonFailure = await request(payload);
  assert.equal(comparisonFailure.status, 500);
  assert.equal(await comparisonFailure.text(), "An unexpected error occurred");
});
