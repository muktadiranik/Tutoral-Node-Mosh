const request = require("supertest");
const { once } = require("node:events");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("config");
const app = require("../..");
const { User } = require("../../models/user");
const { Genre } = require("../../models/genre");

const registration = {
  name: "Alice Morgan",
  email: "alice@example.com",
  password: "test-password",
  isAdmin: false,
};

let server;

// File-level Jest hooks apply to both describe blocks below.
beforeEach(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
});

afterEach(async () => {
  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    server = undefined;
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({});
      await Genre.deleteMany({});
    }
  }
});

const execute = async (token) => {
  return await request(server)
    .post("/api/genres/")
    .set("x-auth-token", token)
    .send({ name: "Horror" });
};

describe("/api/users/me authentication", () => {
  test("should return 401 if no token is provided", async () => {
    const response = await execute("");

    expect(response.status).toBe(401);
  });

  test("should return 201 if token is provided", async () => {
    const response = await execute(new User().generateAuthToken());

    expect(response.status).toBe(201);
  });

  test("should return 400 if token is invalid", async () => {
    const response = await execute("invalid token");

    expect(response.status).toBe(400);
  });
});

describe("Registration and login (real HTTP, bcrypt, JWT, and MongoDB)", () => {
  test("registration stores a password hash and returns a signed identity", async () => {
    const response = await request(server)
      .post("/api/users")
      .send(registration)
      .expect(200);
    const stored = await User.findById(response.body._id);

    expect(stored.email).toBe(registration.email);
    expect(stored.password).not.toBe(registration.password);
    expect(await bcrypt.compare(registration.password, stored.password)).toBe(
      true,
    );
    expect(response.body).not.toHaveProperty("password");
    expect(
      jwt.verify(response.headers["x-auth-token"], config.get("jwtPrivateKey")),
    ).toMatchObject({ _id: String(stored._id), isAdmin: false });
    expect(await User.countDocuments()).toBe(1);
  });

  test("registration rejects invalid input without creating a user", async () => {
    await request(server)
      .post("/api/users")
      .send({ ...registration, email: "bad" })
      .expect(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test("registration requires the role flag in the current implementation", async () => {
    const { isAdmin, ...body } = registration;
    await request(server).post("/api/users").send(body).expect(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test("duplicate registration does not create a second user", async () => {
    await request(server).post("/api/users").send(registration).expect(200);
    await request(server)
      .post("/api/users")
      .send(registration)
      .expect(400, "User already registered");

    expect(await User.countDocuments()).toBe(1);
  });

  test("a registered user can log in and retrieve /me using the issued JWT", async () => {
    const created = await request(server)
      .post("/api/users")
      .send(registration)
      .expect(200);
    const login = await request(server)
      .post("/api/auth")
      .send({
        email: registration.email,
        password: registration.password,
      })
      .expect(200);

    expect(jwt.verify(login.text, config.get("jwtPrivateKey"))).toMatchObject({
      _id: created.body._id,
      isAdmin: false,
    });

    const me = await request(server)
      .get("/api/users/me")
      .set("x-auth-token", login.text)
      .expect(200);
    expect(me.body).toMatchObject({
      _id: created.body._id,
      name: registration.name,
      email: registration.email,
    });
    expect(me.body).not.toHaveProperty("password");
  });

  test("login refuses a wrong password", async () => {
    await request(server).post("/api/users").send(registration).expect(200);
    await request(server)
      .post("/api/auth")
      .send({
        email: registration.email,
        password: "wrong-password",
      })
      .expect(400, "Invalid email or password!");
  });

  test("login refuses an unknown email", async () => {
    await request(server)
      .post("/api/auth")
      .send({
        email: registration.email,
        password: registration.password,
      })
      .expect(400, "Invalid email or password!");
  });

  test("login validates input before authentication", async () => {
    await request(server)
      .post("/api/auth")
      .send({ email: registration.email })
      .expect(400);
  });

  test.each([
    [undefined, 401],
    ["invalid", 400],
  ])("/me refuses token %s with status %i", async (token, status) => {
    const call = request(server).get("/api/users/me");
    if (token) call.set("x-auth-token", token);
    await call.expect(status);
  });
});
