const { Genre } = require("../models/genre");
const { Customer } = require("../models/customer");
const winston = require("winston");
const { startApp, mockCrud, token, objectId } = require("./helpers");

describe.each([
  {
    resource: "genres",
    Model: Genre,
    name: "Genre",
    payload: { name: "Comedy" },
    other: { name: "Horror" },
  },
  {
    resource: "customers",
    Model: Customer,
    name: "Customer",
    payload: { name: "Alice Morgan", phone: "555-0101", isGold: true },
    other: { name: "Other Customer", phone: "555-0102" },
  },
])("$resource HTTP API (mocked persistence)", ({ resource, Model, name, payload, other }) => {
  const endpoint = `/api/${resource}`;
  let http;
  let fixture;
  let id;
  let memberToken;
  let adminToken;

  beforeAll(async () => { http = await startApp(); });
  afterAll(async () => { await http.close(); });
  beforeEach(() => {
    fixture = mockCrud(Model, [payload, other]);
    id = String(fixture.documents[0]._id);
    memberToken = token();
    adminToken = token({ isAdmin: true });
  });

  test("lists records without authentication", async () => {
    const response = await http.request("GET", endpoint);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({ _id: id, name: payload.name });
  });

  test("gets a record by ID without authentication", async () => {
    const response = await http.request("GET", `${endpoint}/${id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id: id, name: payload.name });
  });

  test.each(["GET", "PUT", "DELETE"])("%s rejects malformed IDs before model operations", async (method) => {
    const response = await http.request(method, `${endpoint}/not-an-id`, {
      token: adminToken, body: method === "PUT" ? payload : undefined,
    });
    expect(response.status).toBe(404);
    expect(response.body).toBe(`${name} not found`);
    expect(Model.findById).not.toHaveBeenCalled();
    expect(Model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test.each(["GET", "PUT", "DELETE"])("%s returns 404 for a missing record", async (method) => {
    const response = await http.request(method, `${endpoint}/${objectId()}`, {
      token: adminToken, body: method === "PUT" ? payload : undefined,
    });
    expect(response.status).toBe(404);
    expect(response.body).toBe(`${name} not found`);
  });

  test.each(["POST", "PUT", "DELETE"])("%s requires authentication", async (method) => {
    const response = await http.request(method, method === "POST" ? endpoint : `${endpoint}/${id}`, {
      body: method === "DELETE" ? undefined : payload,
    });
    expect(response.status).toBe(401);
    expect(Model.create).not.toHaveBeenCalled();
    expect(Model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test("creates and normalizes a record", async () => {
    const response = await http.request("POST", endpoint, {
      token: memberToken, body: { ...payload, name: `  ${payload.name}  ` },
    });
    expect(response.status).toBe(201);
    expect(response.body.name).toBe(payload.name);
    expect(response.body._id).toMatch(/^[a-f0-9]{24}$/);
    expect(fixture.store.size).toBe(3);
  });

  test("updates and returns the updated record with validators enabled", async () => {
    const response = await http.request("PUT", `${endpoint}/${id}`, {
      token: memberToken, body: { ...payload, name: "  Updated Name  " },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ _id: id, name: "Updated Name" });
    expect(Model.findByIdAndUpdate).toHaveBeenCalledWith(
      id, expect.objectContaining({ $set: expect.objectContaining({ name: "Updated Name" }) }),
      { returnDocument: "after", runValidators: true },
    );
  });

  test("deletes a record and returns the remaining list", async () => {
    const response = await http.request("DELETE", `${endpoint}/${id}`, { token: adminToken });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body.some((value) => value._id === id)).toBe(false);
    expect(fixture.store.has(id)).toBe(false);
  });

  describe.each(["POST", "PUT"])("%s input validation", (method) => {
    test.each([
      ["missing body", undefined],
      ["empty object", {}],
      ["array", []],
      ["short name", { ...payload, name: "abcd" }],
      ["blank name", { ...payload, name: "   " }],
      ["long name", { ...payload, name: "x".repeat(256) }],
      ["unknown property", { ...payload, unexpected: true }],
    ])("rejects %s before writes", async (_description, body) => {
      const response = await http.request(method, method === "POST" ? endpoint : `${endpoint}/${id}`, {
        token: memberToken, body,
      });
      expect(response.status).toBe(400);
      expect(Model.create).not.toHaveBeenCalled();
      expect(Model.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(fixture.store.size).toBe(2);
    });
  });

  test("rejects malformed JSON", async () => {
    const response = await http.request("POST", endpoint, { token: memberToken, rawBody: '{"name":' });
    expect(response.status).toBe(400);
    expect(Model.create).not.toHaveBeenCalled();
  });

  test.each([
    ["GET", "find"],
    ["GET", "findById"],
    ["POST", "create"],
    ["PUT", "findByIdAndUpdate"],
    ["DELETE", "findByIdAndDelete"],
  ])("handles %s %s failures without leaking details", async (method, operation) => {
    Model[operation].mockRejectedValueOnce(new Error("Private database details"));
    const path = ["find", "create"].includes(operation) ? endpoint : `${endpoint}/${id}`;
    const response = await http.request(method, path, {
      token: adminToken, body: ["POST", "PUT"].includes(method) ? payload : undefined,
    });
    expect(response.status).toBe(500);
    expect(response.body).toBe("An unexpected error occurred");
    expect(winston.error).toHaveBeenCalledWith("Private database details", expect.any(Object));
  });

  if (resource === "genres") {
    test("forbids a non-admin from deleting genres", async () => {
      const response = await http.request("DELETE", `${endpoint}/${id}`, { token: memberToken });
      expect(response.status).toBe(403);
      expect(Model.findByIdAndDelete).not.toHaveBeenCalled();
    });
  } else {
    test("defaults gold membership to false", async () => {
      const response = await http.request("POST", endpoint, {
        token: memberToken, body: { name: "New Customer", phone: "555-0103" },
      });
      expect(response.status).toBe(201);
      expect(response.body.isGold).toBe(false);
    });
  }
});
