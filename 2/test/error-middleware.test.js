const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const winston = require("winston");
const errorHandler = require("../vidly/middleware/error");

function response() {
  return {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test("Error middleware forwards errors when headers are already sent", (t) => {
  const log = t.mock.method(winston, "error", () => {});
  const error = new Error("Response already started");
  const res = response();
  res.headersSent = true;
  let forwarded;

  errorHandler(error, {}, res, (err) => { forwarded = err; });

  assert.equal(forwarded, error);
  assert.equal(res.statusCode, undefined);
  assert.equal(res.body, undefined);
  assert.equal(log.mock.callCount(), 0);
});

test("Error middleware returns 400 for Mongoose validation errors", (t) => {
  const log = t.mock.method(winston, "error", () => {});
  const error = new mongoose.Error.ValidationError();
  const res = response();

  errorHandler(error, {}, res, () => assert.fail("Unexpected next call"));

  assert.equal(res.statusCode, 400);
  assert.equal(res.body, error.message);
  assert.equal(log.mock.callCount(), 0);
});

test("Error middleware preserves client error statuses and messages", (t) => {
  const log = t.mock.method(winston, "error", () => {});
  for (const status of [400, 401, 403, 404, 422, 499]) {
    const error = Object.assign(new Error("Client error"), { status });
    const res = response();

    errorHandler(error, {}, res, () => assert.fail("Unexpected next call"));

    assert.equal(res.statusCode, status);
    assert.equal(res.body, error.message);
  }
  assert.equal(log.mock.callCount(), 0);
});

test("Error middleware logs unexpected errors and hides details in the response", (t) => {
  const log = t.mock.method(winston, "error", () => {});
  const error = new Error("Private database details");
  const res = response();

  errorHandler(error, {}, res, () => assert.fail("Unexpected next call"));

  assert.equal(res.statusCode, 500);
  assert.equal(res.body, "An unexpected error occurred");
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0].arguments, [
    error.message, { stack: error.stack },
  ]);
});
