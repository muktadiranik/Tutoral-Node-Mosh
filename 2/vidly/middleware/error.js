const mongoose = require("mongoose");
const winston = require("winston");

module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).send(error.message);
  }

  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).send(error.message);
  }

  winston.error(error.message, { stack: error.stack });

  res.status(500).send("An unexpected error occurred");
};
