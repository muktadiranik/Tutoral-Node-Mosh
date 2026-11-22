const mongoose = require("mongoose");
const winston = require("winston");
require("winston-mongodb");
const config = require("config");

module.exports = async function () {
  // await mongoose.connect(
  //   process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
  // );

  await mongoose.connect(config.get("database"));

  winston.add(
    new winston.transports.MongoDB({
      db: mongoose.connection.getClient(),
      leaveConnectionOpen: true,
      level: "info",
    }),
  );

  console.log("Connected to MongoDB");
  winston.info("Connected to MongoDB");
};
