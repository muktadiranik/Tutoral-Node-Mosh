const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { User } = require("../models/user");
const auth = require("../middleware/auth");
const { startApp, token } = require("./helpers");

describe("Registration, login, and the current user (mocked persistence)", () => {
  const registration = {
    name: "Alice Morgan",
    email: "alice@example.com",
    password: "secret-password",
    isAdmin: false,
  };
  let http;
  let existing;

  beforeAll(async () => {
    http = await startApp();
    existing = new User({
      ...registration,
      password: await bcrypt.hash(registration.password, 4),
    });
  });
  afterAll(async () => {
    await http.close();
  });
  beforeEach(() => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User.prototype, "save").mockImplementation(async function () {
      await this.validate();
      return this;
    });
    jest.spyOn(User, "findById").mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
  });

  test("should populate 'req.user' with the payload of a valid JWT", async () => {
    const user = new User();
    const token = user.generateAuthToken();
    const req = {
      header: jest.fn().mockReturnValue(token),
    };
    const res = {};
    const next = jest.fn();

    auth(req, res, next);

    expect(req.user).toHaveProperty("_id", String(user._id));
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should populate 'req.user' with the payload of a valid JWT", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId().toHexString(),
      isAdmin: true,
    };
    const token = new User(user).generateAuthToken();
    const req = {
      header: jest.fn().mockReturnValue(token),
    };
    const res = {};
    const next = jest.fn();

    auth(req, res, next);

    expect(req.user).toMatchObject(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should populate 'req.user' with the payload of a valid JWT", async () => {
    const response = await http.request("POST", "/api/users", {
      body: registration,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: registration.name,
      email: registration.email,
      isAdmin: false,
    });
    expect(response.body).not.toHaveProperty("password");
    expect(
      jwt.verify(
        response.headers.get("x-auth-token"),
        process.env.vidly_jwtPrivateKey,
      ),
    ).toMatchObject({ _id: response.body._id, isAdmin: false });
  });

  test("registers a user, hashes the password, and issues a JWT without exposing the hash", async () => {
    const response = await http.request("POST", "/api/users", {
      body: registration,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: registration.name,
      email: registration.email,
      isAdmin: false,
    });
    expect(response.body).not.toHaveProperty("password");
    const saved = User.prototype.save.mock.contexts[0];
    expect(saved.password).not.toBe(registration.password);
    expect(await bcrypt.compare(registration.password, saved.password)).toBe(
      true,
    );
    expect(
      jwt.verify(
        response.headers.get("x-auth-token"),
        process.env.vidly_jwtPrivateKey,
      ),
    ).toMatchObject({ _id: response.body._id, isAdmin: false });
  });

  test("normalizes registration fields before lookup and saving", async () => {
    const response = await http.request("POST", "/api/users", {
      body: {
        ...registration,
        name: "  Alice Morgan  ",
        email: "  alice@example.com  ",
      },
    });
    expect(response.status).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith({ email: registration.email });
    expect(response.body.name).toBe("Alice Morgan");
  });

  test("rejects an already registered email without saving", async () => {
    User.findOne.mockResolvedValue(existing);
    const response = await http.request("POST", "/api/users", {
      body: registration,
    });
    expect(response.status).toBe(400);
    expect(response.body).toBe("User already registered");
    expect(User.prototype.save).not.toHaveBeenCalled();
  });

  test.each([
    ["missing body", undefined],
    ["empty object", {}],
    ["blank name", { ...registration, name: "  " }],
    ["invalid email", { ...registration, email: "not-an-email" }],
    ["blank password", { ...registration, password: "  " }],
    [
      "missing role flag",
      { name: "Alice", email: registration.email, password: "secret" },
    ],
    ["invalid role flag", { ...registration, isAdmin: "not-a-boolean" }],
    ["unknown field", { ...registration, unexpected: true }],
  ])(
    "rejects registration with %s before database access",
    async (_description, body) => {
      const response = await http.request("POST", "/api/users", { body });
      expect(response.status).toBe(400);
      expect(User.findOne).not.toHaveBeenCalled();
      expect(User.prototype.save).not.toHaveBeenCalled();
    },
  );

  test.each(["lookup", "save"])(
    "hides registration %s failures",
    async (operation) => {
      const target =
        operation === "lookup" ? User.findOne : User.prototype.save;
      target.mockRejectedValueOnce(new Error("Private registration error"));
      const response = await http.request("POST", "/api/users", {
        body: registration,
      });
      expect(response.status).toBe(500);
      expect(response.body).toBe("An unexpected error occurred");
      expect(response.headers.has("x-auth-token")).toBe(false);
    },
  );

  // Current behavior, not a security endorsement: clients can choose admin status.
  test("currently includes a client-supplied administrator flag in registration and JWT", async () => {
    const response = await http.request("POST", "/api/users", {
      body: { ...registration, isAdmin: true },
    });
    expect(response.status).toBe(200);
    const claims = jwt.verify(
      response.headers.get("x-auth-token"),
      process.env.vidly_jwtPrivateKey,
    );
    expect(claims).toMatchObject({ _id: response.body._id, isAdmin: true });
    expect(response.body.isAdmin).toBe(true);
    expect(User.prototype.save).toHaveBeenCalledTimes(1);
  });

  test("authenticates a matching real bcrypt hash and signs user identity and role", async () => {
    User.findOne.mockResolvedValue(existing);
    const response = await http.request("POST", "/api/auth", {
      body: { email: existing.email, password: registration.password },
    });
    expect(response.status).toBe(200);
    expect(
      jwt.verify(response.body, process.env.vidly_jwtPrivateKey),
    ).toMatchObject({ _id: String(existing._id), isAdmin: false });
  });

  test.each(["unknown email", "wrong password"])(
    "uses the same error for %s",
    async (reason) => {
      if (reason === "wrong password") User.findOne.mockResolvedValue(existing);
      const response = await http.request("POST", "/api/auth", {
        body: { email: existing.email, password: "incorrect-password" },
      });
      expect(response.status).toBe(400);
      expect(response.body).toBe("Invalid email or password!");
    },
  );

  test.each([
    undefined,
    {},
    [],
    { email: "bad", password: "secret" },
    { email: "alice@example.com" },
    { email: "alice@example.com", password: "   " },
  ])("validates login input %# before lookup", async (body) => {
    const response = await http.request("POST", "/api/auth", { body });
    expect(response.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("handles login lookup failures without exposing details", async () => {
    User.findOne.mockRejectedValueOnce(new Error("Private login error"));
    const response = await http.request("POST", "/api/auth", {
      body: { email: existing.email, password: registration.password },
    });
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
  });

  test("accepts the password hash produced by registration at login", async () => {
    const users = new Map();
    User.findOne.mockImplementation(
      async ({ email }) => users.get(email) || null,
    );
    User.prototype.save.mockImplementation(async function () {
      await this.validate();
      users.set(this.email, this);
      return this;
    });
    const created = await http.request("POST", "/api/users", {
      body: registration,
    });
    const loggedIn = await http.request("POST", "/api/auth", {
      body: { email: registration.email, password: registration.password },
    });
    expect(created.status).toBe(200);
    expect(loggedIn.status).toBe(200);
    expect(jwt.verify(loggedIn.body, process.env.vidly_jwtPrivateKey)._id).toBe(
      created.body._id,
    );
  });

  test.each([
    ["missing token", undefined, 401],
    ["invalid token", "invalid", 400],
  ])("rejects /me with %s", async (_description, authToken, status) => {
    const response = await http.request("GET", "/api/users/me", {
      token: authToken,
    });
    expect(response.status).toBe(status);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test("looks up /me using the JWT identity and excludes the password", async () => {
    const { password, ...publicUser } = existing.toObject();
    const select = jest.fn().mockResolvedValue(publicUser);
    User.findById.mockReturnValue({ select });
    const response = await http.request("GET", "/api/users/me", {
      token: token({ _id: String(existing._id) }),
    });
    expect(response.status).toBe(200);
    expect(User.findById).toHaveBeenCalledWith(String(existing._id));
    expect(select).toHaveBeenCalledWith("-password");
    expect(response.body.email).toBe(existing.email);
    expect(response.body).not.toHaveProperty("password");
  });

  test("handles /me query failures", async () => {
    User.findById.mockReturnValue({
      select: jest
        .fn()
        .mockRejectedValue(new Error("Private user lookup error")),
    });
    const response = await http.request("GET", "/api/users/me", {
      token: token(),
    });
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
  });
});
