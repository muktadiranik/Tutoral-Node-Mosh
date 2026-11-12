const mongoose = require("mongoose");
const Genre = require("./models/genre");
const genres = require("./data/genres");

async function createGenres() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
    );

    // Keep the sample names, but let MongoDB generate each document's _id.
    const genreArray = genres.map(({ name }) => ({ name }));
    const result = await Genre.insertMany(genreArray);
    console.log(`Created ${result.length} genres`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createGenres().catch((err) => {
    console.error("Could not create genres:", err.message);
    process.exitCode = 1;
  });
}

module.exports = createGenres;
