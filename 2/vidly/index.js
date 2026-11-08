const express = require("express");
const genresRouter = require("./routes/genres");

const app = express();
app.use(express.json());
app.use("/api/genres", genresRouter);

if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

module.exports = app;
