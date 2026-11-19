const express = require("express");
const genresRouter = require("../routes/genres");
const customersRouter = require("../routes/customers");
const moviesRouter = require("../routes/movies");
const rentalsRouter = require("../routes/rentals");
const userRouter = require("../routes/users");
const authRouter = require("../routes/auth");
const errorHandler = require("../middleware/error");

module.exports = function (app) {
  app.use(express.json());
  app.use("/api/genres", genresRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/movies", moviesRouter);
  app.use("/api/rentals", rentalsRouter);
  app.use("/api/users", userRouter);
  app.use("/api/auth", authRouter);
  app.use(errorHandler);
};
