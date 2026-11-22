const request = require("supertest");
const { once } = require("node:events");
const mongoose = require("mongoose");
const app = require("../..");
const { Genre } = require("../../models/genre");
const { User } = require("../../models/user");

function token(isAdmin = false) {
  return new User({ isAdmin }).generateAuthToken();
}

describe("/api/genres", () => {
  let server;

  beforeEach(async () => {
    // Vidly exports an Express app; listen() returns the closable HTTP server.
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
        await Genre.deleteMany({});
      }
    }
  });

  const execute = async (name) => {
    const token = new User().generateAuthToken();

    return await request(server)
      .post("/api/genres/")
      .set("x-auth-token", token)
      .send({ name: name });
  };

  test("should return a genre if valid id is passed", async () => {
    const genre = new Genre({ name: "Comedy" });
    await genre.save();

    const response = await request(app).get("/api/genres/" + genre._id);
    expect(response.body).toHaveProperty("name", "Comedy");
  });

  test("should return a 404 if invalid id is passed", async () => {
    const response = await request(app).get("/api/genres/1");
    expect(response.status).toBe(404);
  });

  test("should return a 401 if a client is not logged in", async () => {
    const response = await request(server)
      .post("/api/genres/")
      .send({ name: "Romance" });
    expect(response.status).toBe(401);
  });

  test("should return a 400 if input data is invalid", async () => {
    const response = await execute(new Array(355).join("a"));

    expect(response.status).toBe(400);
  });

  test("should return a 404 if not genre with the given id exists", async () => {
    const _id = new mongoose.Types.ObjectId();

    const response = await request(server).get("/api/genres/" + _id);

    expect(response.status).toBe(404);
  });

  test("should save the genre if it is valid", async () => {
    response = await execute("Romance");

    const genre = await Genre.find({ name: "Romance" });

    expect(genre).not.toBeNull();
  });

  test("should return the genre if it is valid", async () => {
    const response = await execute("Romance");

    expect(response.body).toHaveProperty("_id");
    expect(response.body).toHaveProperty("name", "Romance");
  });

  test("should return a 400 if input data is invalid", async () => {
    const response = await execute("");

    expect(response.status).toBe(400);
  });

  it("Get should return all genres", async () => {
    await Genre.insertMany([{ name: "Comedy" }, { name: "Horror" }]);

    const response = await request(server).get("/api/genres");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body.some((genre) => genre.name === "Comedy")).toBeTruthy();
  });

  test("GET should return an error when genres list is empty", async () => {
    const response = await request(server).get("/api/genres");

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(0);
  });

  test("uses an isolated test database with a real MongoDB connection", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toMatch(
      /^vidly_integration_test_[a-f0-9]{32}$/,
    );
  });

  test("GET returns the genres stored in MongoDB", async () => {
    const genres = await Genre.insertMany([
      { name: "Comedy" },
      { name: "Horror" },
    ]);
    const response = await request(server).get("/api/genres").expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body).toEqual(
      expect.arrayContaining(
        genres.map((genre) => ({
          _id: String(genre._id),
          name: genre.name,
          __v: 0,
        })),
      ),
    );
  });

  test("GET returns an empty list when there are no genres", async () => {
    const response = await request(server).get("/api/genres").expect(200);
    expect(response.body).toEqual([]);
  });

  test("GET by ID returns the stored genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    const response = await request(server)
      .get(`/api/genres/${genre._id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      _id: String(genre._id),
      name: genre.name,
    });
  });

  test.each(["invalid", new mongoose.Types.ObjectId().toHexString()])(
    "GET returns 404 for malformed or missing ID %s",
    async (id) => {
      await request(server)
        .get(`/api/genres/${id}`)
        .expect(404, "Genre not found");
    },
  );

  test("POST requires authentication and does not insert a genre", async () => {
    await request(server)
      .post("/api/genres")
      .send({ name: "Comedy" })
      .expect(401, "Access denied");
    expect(await Genre.countDocuments()).toBe(0);
  });

  test("POST rejects an invalid token without inserting a genre", async () => {
    await request(server)
      .post("/api/genres")
      .set("x-auth-token", "invalid")
      .send({ name: "Comedy" })
      .expect(400, "Invalid token");
    expect(await Genre.countDocuments()).toBe(0);
  });

  test("POST normalizes the name and persists the created genre", async () => {
    const response = await request(server)
      .post("/api/genres")
      .set("x-auth-token", token())
      .send({ name: "  Comedy  " })
      .expect(201);
    const stored = await Genre.findById(response.body._id);

    expect(response.body.name).toBe("Comedy");
    expect(stored.name).toBe("Comedy");
    expect(await Genre.countDocuments()).toBe(1);
  });

  test.each(["", "    ", "abcd", "x".repeat(256)])(
    "POST rejects invalid name %# before inserting",
    async (name) => {
      await request(server)
        .post("/api/genres")
        .set("x-auth-token", token())
        .send({ name })
        .expect(400);
      expect(await Genre.countDocuments()).toBe(0);
    },
  );

  test("POST rejects a missing body", async () => {
    await request(server)
      .post("/api/genres")
      .set("x-auth-token", token())
      .expect(400);
    expect(await Genre.countDocuments()).toBe(0);
  });

  test("PUT persists the new name and returns the updated genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    const response = await request(server)
      .put(`/api/genres/${genre._id}`)
      .set("x-auth-token", token())
      .send({ name: "  Thriller  " })
      .expect(200);

    expect(response.body).toMatchObject({
      _id: String(genre._id),
      name: "Thriller",
    });
    expect((await Genre.findById(genre._id)).name).toBe("Thriller");
  });

  test("PUT rejects invalid input without changing the stored genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    await request(server)
      .put(`/api/genres/${genre._id}`)
      .set("x-auth-token", token())
      .send({ name: "bad" })
      .expect(400);

    expect((await Genre.findById(genre._id)).name).toBe("Comedy");
  });

  test("PUT requires authentication without changing the stored genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    await request(server)
      .put(`/api/genres/${genre._id}`)
      .send({ name: "Thriller" })
      .expect(401);

    expect((await Genre.findById(genre._id)).name).toBe("Comedy");
  });

  test("PUT returns 404 for a missing genre", async () => {
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(server)
      .put(`/api/genres/${id}`)
      .set("x-auth-token", token())
      .send({ name: "Thriller" })
      .expect(404, "Genre not found");
  });

  test("DELETE removes a genre for an admin and returns the remaining genres", async () => {
    const [removed, remaining] = await Genre.insertMany([
      { name: "Comedy" },
      { name: "Horror" },
    ]);
    const response = await request(server)
      .delete(`/api/genres/${removed._id}`)
      .set("x-auth-token", token(true))
      .expect(200);

    expect(await Genre.findById(removed._id)).toBeNull();
    expect(await Genre.countDocuments()).toBe(1);
    expect(response.body).toEqual([
      expect.objectContaining({
        _id: String(remaining._id),
        name: remaining.name,
      }),
    ]);
  });

  test("DELETE refuses non-admin users without removing the genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    await request(server)
      .delete(`/api/genres/${genre._id}`)
      .set("x-auth-token", token())
      .expect(403, "Forbidden");

    expect(await Genre.findById(genre._id)).not.toBeNull();
  });

  test("DELETE requires authentication without removing the genre", async () => {
    const genre = await Genre.create({ name: "Comedy" });
    await request(server).delete(`/api/genres/${genre._id}`).expect(401);

    expect(await Genre.findById(genre._id)).not.toBeNull();
  });

  test("DELETE returns 404 for a missing genre", async () => {
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(server)
      .delete(`/api/genres/${id}`)
      .set("x-auth-token", token(true))
      .expect(404, "Genre not found");
  });

  test("supports create, read, update, and delete through HTTP", async () => {
    const created = await request(server)
      .post("/api/genres")
      .set("x-auth-token", token())
      .send({ name: "Comedy" })
      .expect(201);
    const endpoint = `/api/genres/${created.body._id}`;

    await request(server).get(endpoint).expect(200);
    await request(server)
      .put(endpoint)
      .set("x-auth-token", token())
      .send({ name: "Thriller" })
      .expect(200);
    const updated = await request(server).get(endpoint).expect(200);
    expect(updated.body.name).toBe("Thriller");
    await request(server)
      .delete(endpoint)
      .set("x-auth-token", token(true))
      .expect(200);
    await request(server).get(endpoint).expect(404);
    expect(await Genre.countDocuments()).toBe(0);
  });
});
