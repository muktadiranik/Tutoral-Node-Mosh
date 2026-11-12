const express = require("express");
const mongoose = require("mongoose");
const genresRouter = require("./routes/genres");

const app = express();
app.use(express.json());
app.use("/api/genres", genresRouter);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).send(err.message);
  }

  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).send(err.message);
  }

  console.error(err);
  res.status(500).send("An unexpected error occurred");
});

if (require.main === module) {
  const port = process.env.PORT || 3000;

  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
    )
    .then(() => {
      console.log("Connected to MongoDB");
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Could not connect to MongoDB:", err.message);
      process.exitCode = 1;
    });
}

module.exports = app;
