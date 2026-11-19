const winston = require("winston");
const fs = require("fs");

module.exports = function () {
  winston.add(new winston.transports.File({ filename: "logfile.log" }));
  winston.add(
    new winston.transports.Console({ colorize: true, prettyPrint: true }),
  );
  winston.exceptions.handle(
    new winston.transports.Stream({
      stream: fs.createWriteStream("exceptions.log", { flags: "a" }),
    }),
  );
  winston.rejections.handle(
    new winston.transports.Stream({
      stream: fs.createWriteStream("rejections.log", { flags: "a" }),
    }),
  );
};
