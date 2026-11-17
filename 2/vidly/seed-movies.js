const mongoose = require("mongoose");
const { Movie } = require("./models/movie");
const Genre = require("./models/genre");
const movies = require("./data/movies");

async function createMovies() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
    );

    const genreNames = [...new Set(movies.map(({ genreName }) => genreName))];
    const genres = await Genre.find({ name: { $in: genreNames } });
    const genresByName = new Map(genres.map((genre) => [genre.name, genre]));
    const missingGenres = genreNames.filter((name) => !genresByName.has(name));
    if (missingGenres.length) {
      throw new Error(
        `Missing genres: ${missingGenres.join(", ")}. Run npm run seed:vidly from 2/ first.`,
      );
    }

    // Embed existing genres and let MongoDB generate each movie's _id.
    const movieArray = movies.map(({ title, genreName, numberInStock, dailyRentalRate }) => {
      const genre = genresByName.get(genreName);
      return {
        title,
        genre: { _id: genre._id, name: genre.name },
        numberInStock,
        dailyRentalRate,
      };
    });
    const result = await Movie.insertMany(movieArray);
    console.log(`Created ${result.length} movies`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createMovies().catch((err) => {
    console.error("Could not create movies:", err.message);
    process.exitCode = 1;
  });
}

module.exports = createMovies;
