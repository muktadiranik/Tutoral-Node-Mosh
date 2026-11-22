const mongoose = require("mongoose");
const winston = require("winston");
const { Rental } = require("../models/rental");
const { Movie } = require("../models/movie");
const { Customer } = require("../models/customer");
const { startApp, token, objectId } = require("./helpers");

describe("Rental HTTP API (mocked persistence and stock updates)", () => {
  let http;
  let customer;
  let movie;
  let payload;
  let state;
  let authToken;
  let rentals;
  let sort;

  beforeAll(async () => { http = await startApp(); });
  afterAll(async () => { await http.close(); });
  beforeEach(() => {
    customer = new Customer({ name: "Alice Morgan", phone: "555-0101", isGold: true });
    movie = new Movie({
      title: "The Matrix", genre: { name: "Sci-Fi" }, numberInStock: 2, dailyRentalRate: 2.5,
    });
    payload = { customerId: String(customer._id), movieId: String(movie._id) };
    authToken = token();
    state = { stock: 2, saved: [] };
    rentals = ["2026-01-01", "2026-01-02"].map((date) => new Rental({
      customer: customer.name, phone: customer.phone, isGold: customer.isGold,
      movie: { _id: movie._id, title: movie.title, dailyRentalRate: movie.dailyRentalRate },
      rentalFee: 0, dateOut: new Date(date),
    }));
    sort = jest.fn().mockResolvedValue([...rentals].reverse());
    jest.spyOn(Rental, "find").mockReturnValue({ sort });
    jest.spyOn(Rental, "findById").mockImplementation(async (id) =>
      rentals.find((rental) => String(rental._id) === id) || null);
    jest.spyOn(Customer, "findById").mockResolvedValue(customer);
    jest.spyOn(Movie, "findById").mockResolvedValue(movie);
    jest.spyOn(Movie, "updateOne").mockImplementation(async (filter, update) => {
      if (update.$inc.numberInStock === -1) {
        expect(filter).toEqual({ _id: movie._id, numberInStock: { $gte: 1 } });
        if (state.stock === 0) return { matchedCount: 0, modifiedCount: 0 };
      } else {
        expect(filter).toEqual({ _id: movie._id });
        expect(update.$inc.numberInStock).toBe(1);
      }
      state.stock += update.$inc.numberInStock;
      return { matchedCount: 1, modifiedCount: 1 };
    });
    jest.spyOn(Rental.prototype, "save").mockImplementation(async function () {
      await this.validate();
      state.saved.push(this);
      return this;
    });
    jest.spyOn(mongoose.connection, "transaction").mockImplementation(() => {
      throw new Error("Rental creation must support standalone MongoDB");
    });
  });

  function create(body = payload) {
    return http.request("POST", "/api/rentals", { token: authToken, body });
  }

  test("lists rentals newest first without authentication", async () => {
    const response = await http.request("GET", "/api/rentals");
    expect(response.status).toBe(200);
    expect(sort).toHaveBeenCalledWith({ dateOut: -1 });
    expect(response.body.map((rental) => rental._id))
      .toEqual([...rentals].reverse().map((rental) => String(rental._id)));
  });

  test("gets a rental by ID without authentication", async () => {
    const response = await http.request("GET", `/api/rentals/${rentals[0]._id}`);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(String(rentals[0]._id));
  });

  test.each(["not-an-id", "missing"])("returns 404 for %s", async (id) => {
    const response = await http.request("GET", `/api/rentals/${id === "missing" ? objectId() : id}`);
    expect(response.status).toBe(404);
    expect(response.body).toBe("Rental not found");
    if (id !== "missing") expect(Rental.findById).not.toHaveBeenCalled();
  });

  test("requires authentication before lookups and stock updates", async () => {
    const response = await http.request("POST", "/api/rentals", { body: payload });
    expect(response.status).toBe(401);
    expect(Customer.findById).not.toHaveBeenCalled();
    expect(Movie.updateOne).not.toHaveBeenCalled();
  });

  test.each([
    {}, [], { customerId: "bad", movieId: "bad" },
    { movieId: "507f1f77bcf86cd799439011" },
    { customerId: "507f1f77bcf86cd799439011" },
    { customerId: "507f1f77bcf86cd799439011", movieId: "507f1f77bcf86cd799439012", extra: true },
  ])("validates request %# before database access", async (body) => {
    const response = await create(body);
    expect(response.status).toBe(400);
    expect(Customer.findById).not.toHaveBeenCalled();
    expect(Movie.updateOne).not.toHaveBeenCalled();
  });

  test("rejects a missing customer without changing stock", async () => {
    Customer.findById.mockResolvedValueOnce(null);
    const response = await create();
    expect(response.status).toBe(400);
    expect(response.body).toBe("Invalid Customer Id");
    expect(Movie.findById).not.toHaveBeenCalled();
    expect(Movie.updateOne).not.toHaveBeenCalled();
  });

  test("rejects a missing movie without changing stock", async () => {
    Movie.findById.mockResolvedValueOnce(null);
    const response = await create();
    expect(response.status).toBe(400);
    expect(response.body).toBe("Invalid Movie Id");
    expect(Movie.updateOne).not.toHaveBeenCalled();
  });

  test("validates the rental snapshot before decrementing stock", async () => {
    customer.phone = "bad";
    const response = await create();
    expect(response.status).toBe(400);
    expect(response.body).toMatch(/phone/);
    expect(Movie.updateOne).not.toHaveBeenCalled();
    expect(Rental.prototype.save).not.toHaveBeenCalled();
  });

  test("saves snapshots and decrements stock without a transaction", async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      customer: customer.name, phone: customer.phone, isGold: true, rentalFee: 0,
      movie: { _id: String(movie._id), title: movie.title, dailyRentalRate: 2.5 },
      dateReturned: null,
    });
    expect(response.body.dateOut).toBeDefined();
    expect(state.stock).toBe(1);
    expect(state.saved).toHaveLength(1);
    expect(mongoose.connection.transaction).not.toHaveBeenCalled();
  });

  test("refuses an out-of-stock movie without saving", async () => {
    state.stock = 0;
    const response = await create();
    expect(response.status).toBe(400);
    expect(response.body).toBe("Movie is not in stock");
    expect(Rental.prototype.save).not.toHaveBeenCalled();
  });

  test("restores stock when saving fails and hides the original error", async () => {
    Rental.prototype.save.mockRejectedValueOnce(new Error("Private save failure"));
    const response = await create();
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
    expect(state.stock).toBe(2);
    expect(state.saved).toHaveLength(0);
    expect(Movie.updateOne).toHaveBeenNthCalledWith(2, { _id: movie._id }, { $inc: { numberInStock: 1 } });
  });

  test("logs failed compensation while preserving the original save error", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const saveError = new Error("Private save failure");
    const restoreError = new Error("Private restoration failure");
    Rental.prototype.save.mockRejectedValueOnce(saveError);
    Movie.updateOne.mockResolvedValueOnce({ matchedCount: 1 }).mockRejectedValueOnce(restoreError);
    const response = await create();
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Could not restore stock"), expect.objectContaining({
      movieId: String(movie._id), error: restoreError,
    }));
    expect(winston.error).toHaveBeenCalledWith(saveError.message, { stack: saveError.stack });
  });

  test("logs compensation when the movie was removed", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    Rental.prototype.save.mockRejectedValueOnce(new Error("Save failed"));
    Movie.updateOne.mockResolvedValueOnce({ matchedCount: 1 }).mockResolvedValueOnce({ matchedCount: 0 });
    const response = await create();
    expect(response.status).toBe(500);
    expect(log.mock.calls[0][1].error.message).toMatch(/Movie not found/);
  });

  test.each(["customer", "movie", "stock"])("hides %s operation failures without saving", async (operation) => {
    const target = { customer: Customer.findById, movie: Movie.findById, stock: Movie.updateOne }[operation];
    target.mockRejectedValueOnce(new Error("Private persistence failure"));
    const response = await create();
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
    expect(Rental.prototype.save).not.toHaveBeenCalled();
  });

  test("guards the last copy across two requests using the mocked atomic update", async () => {
    state.stock = 1;
    const responses = await Promise.all([create(), create()]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(state.stock).toBe(0);
    expect(state.saved).toHaveLength(1);
  });
});
