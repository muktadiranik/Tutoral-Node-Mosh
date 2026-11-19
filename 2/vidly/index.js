const path = require("path");
const express = require("express");
const winston = require("winston");

if (!process.env.NODE_CONFIG_DIR) {
  process.env.NODE_CONFIG_DIR = path.join(__dirname, "config");
}

const app = express();

require("./startup/routes")(app);

if (require.main === module) {
  const port = process.env.PORT || 3000;

  require("./startup/config")();
  require("./startup/logging")();
  require("./startup/database")()
    .then(() => {
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
        winston.info(`Listening on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Could not connect to MongoDB:", err.message);
      winston.error("Could not connect to MongoDB:", err.message);
      process.exitCode = 1;
    });
}

module.exports = app;
