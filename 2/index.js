const path = require("node:path");

if (!process.env.NODE_CONFIG_DIR) {
  process.env.NODE_CONFIG_DIR = path.join(__dirname, "config");
}

const config = require("config");
const express = require("express");
const morgan = require("morgan");
const startupDebugger = require("debug")("app:startup");
const dbDebugger = require("debug")("app:db");
const { startup, authenticate } = require("./middleware/logger");
const helmet = require("helmet");
const app = express();

const coursesRouter = require("./routes/courses");
const homeRouter = require("./routes/home");

console.log(`Application Name: ${config.get("name")}`);

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`app: ${app.get("env")}`);

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
if (app.get("env") === "development") {
  app.use(morgan("dev"));
  startupDebugger("morgan is running");
  dbDebugger("morgan is running");
  console.log("morgan is running");
}
app.use(express.static(path.join(__dirname, "public")));

app.use(startup);
app.use(authenticate);
app.use("/api/courses", coursesRouter);
app.use("/", homeRouter);

if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;
