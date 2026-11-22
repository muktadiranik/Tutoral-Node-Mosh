const { once } = require("node:events");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

function objectId() {
  return new mongoose.Types.ObjectId().toHexString();
}

function token(claims = {}, options = {}) {
  return jwt.sign(
    { _id: objectId(), isAdmin: false, ...claims },
    process.env.vidly_jwtPrivateKey,
    options,
  );
}

async function startApp() {
  const app = require("..");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    async request(method, endpoint, options = {}) {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}${endpoint}`,
        {
          method,
          headers: {
            ...(options.body === undefined && options.rawBody === undefined
              ? {} : { "Content-Type": "application/json" }),
            ...(options.token ? { "X-Auth-Token": options.token } : {}),
            ...options.headers,
          },
          body: options.rawBody !== undefined ? options.rawBody
            : options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: AbortSignal.timeout(5000),
        },
      );
      const text = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        body: response.headers.get("content-type")?.includes("application/json")
          ? JSON.parse(text) : text,
      };
    },
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

// Real documents and validation; only persistence operations are replaced.
function mockCrud(Model, data) {
  const documents = data.map((value) => new Model(value));
  const store = new Map(documents.map((document) => [String(document._id), document]));
  jest.spyOn(Model, "find").mockImplementation(async () => [...store.values()]);
  jest.spyOn(Model, "findById").mockImplementation(async (id) =>
    store.get(String(id).toLowerCase()) || null);
  jest.spyOn(Model, "create").mockImplementation(async (value) => {
    const document = new Model(value);
    await document.validate();
    store.set(String(document._id), document);
    return document;
  });
  jest.spyOn(Model, "findByIdAndUpdate").mockImplementation(async (id, update) => {
    const original = store.get(String(id));
    if (!original) return null;
    const document = new Model({ ...original.toObject(), ...update.$set });
    await document.validate();
    store.set(String(id), document);
    return document;
  });
  jest.spyOn(Model, "findByIdAndDelete").mockImplementation(async (id) => {
    const document = store.get(String(id)) || null;
    store.delete(String(id));
    return document;
  });
  return { documents, store };
}

module.exports = { objectId, token, startApp, mockCrud };
