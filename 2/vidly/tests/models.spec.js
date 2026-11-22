const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Genre } = require("../models/genre");
const { Customer } = require("../models/customer");
const { Movie } = require("../models/movie");
const { Rental } = require("../models/rental");
const { User } = require("../models/user");
const config = require("config");

describe("Mongoose schemas (offline, real validation)", () => {
  test.each(["Comedy", "x".repeat(255)])(
    "trims a valid genre name of length %#",
    async (name) => {
      const genre = new Genre({ name: `  ${name}  ` });
      await expect(genre.validate()).resolves.toBeUndefined();
      expect(genre.name).toBe(name);
    },
  );

  test.each([undefined, null, "", "   ", "abcd", "x".repeat(256)])(
    "rejects invalid genre name %#",
    async (name) => {
      await expect(new Genre({ name }).validate()).rejects.toHaveProperty(
        "errors.name",
      );
    },
  );

  test("trims customer fields and defaults gold membership to false", async () => {
    const customer = new Customer({
      name: "  Alice Morgan  ",
      phone: "  555-0101  ",
    });
    await expect(customer.validate()).resolves.toBeUndefined();
    expect(customer.name).toBe("Alice Morgan");
    expect(customer.phone).toBe("555-0101");
    expect(customer.isGold).toBe(false);
  });

  test.each(["", "abcd", "x".repeat(256)])(
    "rejects invalid customer phone %#",
    async (phone) => {
      await expect(
        new Customer({ name: "Alice Morgan", phone }).validate(),
      ).rejects.toHaveProperty("errors.phone");
    },
  );

  function movie(overrides = {}) {
    return new Movie({
      title: "The Matrix",
      genre: { name: "Sci-Fi" },
      numberInStock: 2,
      dailyRentalRate: 2.5,
      ...overrides,
    });
  }

  test.each([0, 1, 255])("accepts integral stock %i", async (numberInStock) => {
    await expect(movie({ numberInStock }).validate()).resolves.toBeUndefined();
  });

  test.each([undefined, -1, 0.5, 256])(
    "rejects invalid stock %s",
    async (numberInStock) => {
      await expect(movie({ numberInStock }).validate()).rejects.toHaveProperty(
        "errors.numberInStock",
      );
    },
  );

  test.each([-1, 256, undefined])(
    "rejects invalid rental rate %s",
    async (dailyRentalRate) => {
      await expect(
        movie({ dailyRentalRate }).validate(),
      ).rejects.toHaveProperty("errors.dailyRentalRate");
    },
  );

  test("validates the embedded genre rather than accepting an invalid snapshot", async () => {
    await expect(
      movie({ genre: { name: "bad" } }).validate(),
    ).rejects.toHaveProperty(["errors", "genre.name"]);
  });

  test("defaults rental dates and preserves a schema-compatible customer/movie snapshot", async () => {
    const rental = new Rental({
      customer: "Alice Morgan",
      phone: "555-0101",
      movie: { title: "The Matrix", dailyRentalRate: 2.5 },
      rentalFee: 0,
    });
    await expect(rental.validate()).resolves.toBeUndefined();
    expect(rental.dateOut).toBeInstanceOf(Date);
    expect(rental.dateReturned).toBeNull();
    expect(rental.isGold).toBe(false);
  });

  test.each([false, true])(
    "signs the user's identity and isAdmin=%s into its token",
    (isAdmin) => {
      const user = new User({
        name: "Alice",
        email: "alice@example.com",
        password: "hash",
        isAdmin,
      });
      const decoded = jwt.verify(
        user.generateAuthToken(),
        config.get("jwtPrivateKey"),
      );
      expect(decoded).toMatchObject({ _id: String(user._id), isAdmin });
      expect(decoded).not.toHaveProperty("password");
      expect(decoded).not.toHaveProperty("email");
    },
  );

  test("user generates a valid JWT token", () => {
    const payload = {
      _id: new mongoose.Types.ObjectId().toHexString(),
      isAdmin: true,
    };
    const user = new User(payload);
    const token = user.generateAuthToken();
    const decodedToken = jwt.verify(token, config.get("jwtPrivateKey"));
    expect(decodedToken).toMatchObject(payload);
  });
});
