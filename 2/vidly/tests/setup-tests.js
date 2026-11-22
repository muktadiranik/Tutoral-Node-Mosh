const mongoose = require("mongoose");
const winston = require("winston");

// An unstubbed query should fail immediately, not wait for a real database.
mongoose.set("bufferCommands", false);

beforeEach(() => {
  jest.spyOn(mongoose, "connect").mockImplementation(() => {
    throw new Error("Jest tests must not connect to MongoDB");
  });
  jest.spyOn(winston, "error").mockImplementation(() => winston);
});
