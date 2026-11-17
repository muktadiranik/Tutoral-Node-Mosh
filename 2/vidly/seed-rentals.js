const mongoose = require("mongoose");
const { Rental } = require("./models/rental");
const { Customer } = require("./models/customer");
const { Movie } = require("./models/movie");
const rentals = require("./data/rentals");

async function createRentals() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
    );

    const customerPhones = [...new Set(rentals.map(({ phone }) => phone))];
    const movieTitles = [...new Set(rentals.map(({ movie }) => movie.title))];
    const customers = await Customer.find({ phone: { $in: customerPhones } });
    const movies = await Movie.find({ title: { $in: movieTitles } });
    const customersByPhone = new Map(customers.map((customer) => [customer.phone, customer]));
    const moviesByTitle = new Map(movies.map((movie) => [movie.title, movie]));

    const missingCustomers = customerPhones.filter((phone) => !customersByPhone.has(phone));
    if (missingCustomers.length) {
      throw new Error(
        `Missing customers: ${missingCustomers.join(", ")}. Run npm run seed:customers from 2/ first.`,
      );
    }
    const missingMovies = movieTitles.filter((title) => !moviesByTitle.has(title));
    if (missingMovies.length) {
      throw new Error(
        `Missing movies: ${missingMovies.join(", ")}. Run npm run seed:movies from 2/ first.`,
      );
    }

    // Seed sample records only: no stock changes or transactions are needed.
    const rentalArray = rentals.map((sample) => {
      const customer = customersByPhone.get(sample.phone);
      const movie = moviesByTitle.get(sample.movie.title);

      // Copy the current customer/movie fields; generate rental IDs and dates.
      return {
        customer: customer.name,
        isGold: customer.isGold,
        phone: customer.phone,
        movie: {
          _id: movie._id,
          title: movie.title,
          dailyRentalRate: movie.dailyRentalRate,
        },
        rentalFee: 0,
      };
    });

    const result = await Rental.insertMany(rentalArray);
    console.log(`Created ${result.length} rentals`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createRentals().catch((err) => {
    console.error("Could not create rentals:", err.message);
    process.exitCode = 1;
  });
}

module.exports = createRentals;
