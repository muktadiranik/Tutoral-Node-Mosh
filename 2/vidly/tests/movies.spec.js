const { Movie } = require("../models/movie");
const { Genre } = require("../models/genre");
const { startApp, mockCrud, token, objectId } = require("./helpers");

describe("Movie HTTP API (mocked persistence)", () => {
  let http;
  let genre;
  let fixture;
  let payload;
  let authToken;
  let id;
  let sort;

  beforeAll(async () => { http = await startApp(); });
  afterAll(async () => { await http.close(); });
  beforeEach(() => {
    genre = new Genre({ name: "Comedy" });
    payload = { title: "New Movie", genreId: String(genre._id), numberInStock: 2, dailyRentalRate: 2.5 };
    fixture = mockCrud(Movie, [
      { title: "Zulu Movie", genre, numberInStock: 2, dailyRentalRate: 2.5 },
      { title: "Alpha Movie", genre, numberInStock: 1, dailyRentalRate: 3 },
    ]);
    id = String(fixture.documents[0]._id);
    authToken = token();
    sort = jest.fn().mockImplementation(async () =>
      [...fixture.store.values()].sort((a, b) => a.title.localeCompare(b.title)));
    Movie.find.mockImplementation(() => ({ sort }));
    jest.spyOn(Genre, "findById").mockResolvedValue(genre);
  });

  test("lists movies sorted by title without authentication", async () => {
    const response = await http.request("GET", "/api/movies");
    expect(response.status).toBe(200);
    expect(response.body.map((movie) => movie.title)).toEqual(["Alpha Movie", "Zulu Movie"]);
    expect(sort).toHaveBeenCalledWith({ title: 1 });
  });

  test("gets a movie and its embedded genre", async () => {
    const response = await http.request("GET", `/api/movies/${id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: id, title: "Zulu Movie", genre: { _id: String(genre._id), name: "Comedy" },
    });
  });

  test.each(["GET", "PUT", "DELETE"])("%s rejects malformed IDs", async (method) => {
    const response = await http.request(method, "/api/movies/not-an-id", {
      token: authToken, body: method === "PUT" ? payload : undefined,
    });
    expect(response.status).toBe(404);
    expect(Movie.findById).not.toHaveBeenCalled();
    expect(Movie.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Movie.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test.each(["GET", "DELETE"])("%s returns 404 for a missing movie", async (method) => {
    const response = await http.request(method, `/api/movies/${objectId()}`, { token: authToken });
    expect(response.status).toBe(404);
    expect(response.body).toBe("Movie not found");
  });

  test.each(["POST", "PUT", "DELETE"])("%s requires authentication before writes", async (method) => {
    const response = await http.request(method, method === "POST" ? "/api/movies" : `/api/movies/${id}`, {
      body: method === "DELETE" ? undefined : payload,
    });
    expect(response.status).toBe(401);
    expect(Movie.create).not.toHaveBeenCalled();
    expect(Movie.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Movie.findByIdAndDelete).not.toHaveBeenCalled();
  });

  // Characterize the current validator mismatch without changing application code.
  test("currently rejects movie creation with numberInStock before persistence", async () => {
    const response = await http.request("POST", "/api/movies", { token: authToken, body: payload });
    expect(response.status).toBe(400);
    expect(response.body).toBe('"numberInStock" is not allowed');
    expect(Genre.findById).not.toHaveBeenCalled();
    expect(Movie.create).not.toHaveBeenCalled();
    expect(fixture.store.size).toBe(2);
  });

  test("currently rejects movie updates with numberInStock before persistence", async () => {
    const response = await http.request("PUT", `/api/movies/${id}`, { token: authToken, body: payload });
    expect(response.status).toBe(400);
    expect(response.body).toBe('"numberInStock" is not allowed');
    expect(Genre.findById).not.toHaveBeenCalled();
    expect(Movie.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(fixture.store.get(id).title).toBe("Zulu Movie");
  });

  test("currently rejects creation without stock during document validation", async () => {
    const { numberInStock, ...body } = payload;
    const response = await http.request("POST", "/api/movies", { token: authToken, body });
    expect(response.status).toBe(400);
    expect(response.body).toMatch(/numberInStock.*required/);
    expect(Movie.create).toHaveBeenCalledTimes(1);
    expect(fixture.store.size).toBe(2);
  });

  test.each([
    undefined, {}, [],
    { title: "abcd", genreId: "bad", dailyRentalRate: 1 },
    { title: "Valid Title", genreId: "bad", dailyRentalRate: 1 },
    { title: "Valid Title", genreId: "507f1f77bcf86cd799439011", dailyRentalRate: -1 },
  ])("rejects invalid request %# before model lookup or writes", async (body) => {
    const response = await http.request("POST", "/api/movies", { token: authToken, body });
    expect(response.status).toBe(400);
    expect(Genre.findById).not.toHaveBeenCalled();
    expect(Movie.create).not.toHaveBeenCalled();
  });

  test("rejects an unknown genre", async () => {
    Genre.findById.mockResolvedValueOnce(null);
    const { numberInStock, ...body } = payload;
    const response = await http.request("POST", "/api/movies", { token: authToken, body });
    expect(response.status).toBe(400);
    expect(response.body).toBe("Invalid Genre Id");
    expect(Movie.create).not.toHaveBeenCalled();
  });

  test("deletes and returns a movie", async () => {
    const response = await http.request("DELETE", `/api/movies/${id}`, { token: authToken });
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(id);
    expect(fixture.store.has(id)).toBe(false);
  });

  test.each(["list", "lookup", "delete"])("hides %s database failures", async (operation) => {
    const error = new Error("Private movie database error");
    if (operation === "list") sort.mockRejectedValueOnce(error);
    if (operation === "lookup") Movie.findById.mockRejectedValueOnce(error);
    if (operation === "delete") Movie.findByIdAndDelete.mockRejectedValueOnce(error);
    const response = await http.request(operation === "delete" ? "DELETE" : "GET",
      operation === "list" ? "/api/movies" : `/api/movies/${id}`, { token: authToken });
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
  });
});
