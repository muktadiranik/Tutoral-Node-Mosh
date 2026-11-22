const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const winston = require("winston");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const errorHandler = require("../middleware/error");
const asyncMiddleware = require("../middleware/async");
const { token, objectId } = require("./helpers");

function response() {
  const res = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe("Authentication middleware", () => {
  test("returns 401 if the token is missing", () => {
    const res = response();
    const next = jest.fn();
    auth({ header: () => undefined }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Access denied");
    expect(next).not.toHaveBeenCalled();
  });

  test("decodes a valid JWT and continues", () => {
    const id = objectId();
    const req = { header: jest.fn().mockReturnValue(token({ _id: id, isAdmin: true })) };
    const res = response();
    const next = jest.fn();
    auth(req, res, next);
    expect(req.header).toHaveBeenCalledWith("x-auth-token");
    expect(req.user).toMatchObject({ _id: id, isAdmin: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.send).not.toHaveBeenCalled();
  });

  test.each([
    ["malformed", () => "not-a-jwt"],
    ["expired", () => token({}, { expiresIn: -1 })],
    ["wrong signing key", () => jwt.sign({ _id: objectId() }, "different-test-key")],
    ["Bearer prefix", () => `Bearer ${token()}`],
  ])("rejects a token with %s", (_description, makeToken) => {
    const res = response();
    const next = jest.fn();
    auth({ header: () => makeToken() }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid token");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Administrator middleware", () => {
  test.each([false, undefined])("rejects isAdmin=%s", (isAdmin) => {
    const res = response();
    const next = jest.fn();
    admin({ user: { isAdmin } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("continues for an administrator", () => {
    const res = response();
    const next = jest.fn();
    admin({ user: { isAdmin: true } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("Error middleware", () => {
  test("delegates when the response has already started", () => {
    const error = new Error("Late error");
    const res = response();
    res.headersSent = true;
    const next = jest.fn();
    errorHandler(error, {}, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(winston.error).not.toHaveBeenCalled();
  });

  test("returns 400 for Mongoose validation failures", () => {
    const error = new mongoose.Error.ValidationError();
    const res = response();
    errorHandler(error, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(error.message);
    expect(winston.error).not.toHaveBeenCalled();
  });

  test.each([400, 401, 403, 404, 422, 499])("preserves client status %i", (status) => {
    const error = Object.assign(new Error("Client error"), { status });
    const res = response();
    errorHandler(error, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.send).toHaveBeenCalledWith(error.message);
    expect(winston.error).not.toHaveBeenCalled();
  });

  test("logs unexpected errors with a stack and hides internal details", () => {
    const error = new Error("Private connection string");
    const res = response();
    errorHandler(error, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("An unexpected error occurred");
    expect(winston.error).toHaveBeenCalledWith(error.message, { stack: error.stack });
  });
});

describe("Legacy async wrapper", () => {
  test("returns a function and awaits its handler", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const next = jest.fn();
    const middleware = asyncMiddleware(handler);
    expect(typeof middleware).toBe("function");
    await middleware("request", "response", next);
    expect(handler).toHaveBeenCalledWith("request", "response");
    expect(next).not.toHaveBeenCalled();
  });

  test("forwards rejected promises to next", async () => {
    const error = new Error("Handler failed");
    const next = jest.fn();
    await asyncMiddleware(async () => { throw error; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
