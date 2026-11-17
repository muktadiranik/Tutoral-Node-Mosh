const express = require("express");
const mongoose = require("mongoose");
const { Rental, validate } = require("../models/rental");
const { Customer } = require("../models/customer");
const { Movie } = require("../models/movie");
const router = express.Router();

router.param("id", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(404).send("Rental not found");
  }

  next();
});

router.get("/", async (req, res) => {
  const rentals = await Rental.find().sort({ dateOut: -1 });
  res.send(rentals);
});

router.get("/:id", async (req, res) => {
  const rental = await Rental.findById(req.params.id);
  if (!rental) return res.status(404).send("Rental not found");

  res.send(rental);
});

router.post("/", async (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  // A replica set or sharded deployment is required for this transaction.
  const rental = await mongoose.connection.transaction(
    async (session) => {
      const customer = await Customer.findById(value.customerId).session(
        session,
      );
      if (!customer) {
        throw Object.assign(new Error("Invalid Customer Id"), { status: 400 });
      }

      const movie = await Movie.findById(value.movieId).session(session);
      if (!movie) {
        throw Object.assign(new Error("Invalid Movie Id"), { status: 400 });
      }

      if (movie.numberInStock === 0) {
        throw Object.assign(new Error("Movie is not in stock"), {
          status: 400,
        });
      }

      // Guard the decrement so stock cannot go below zero.
      const result = await Movie.updateOne(
        { _id: movie._id, numberInStock: { $gte: 1 } },
        { $inc: { numberInStock: -1 } },
        { session },
      );

      if (result.matchedCount !== 1) {
        throw Object.assign(new Error("Movie is not in stock"), {
          status: 400,
        });
      }

      if (result.modifiedCount !== 1) {
        throw Object.assign(new Error("Movie is not in stock"), {
          status: 400,
        });
      }

      // Preserve the rental schema's flat customer fields and movie snapshot.
      const rental = new Rental({
        customer: customer.name,
        isGold: customer.isGold,
        phone: customer.phone,
        movie: {
          _id: movie._id,
          title: movie.title,
          dailyRentalRate: movie.dailyRentalRate,
        },
        rentalFee: 0,
      });
      await rental.save({ session });
      return rental;
    },
    { readPreference: "primary" },
  );

  // Do not acknowledge success until the transaction has committed.
  res.status(201).send(rental);
});

module.exports = router;
