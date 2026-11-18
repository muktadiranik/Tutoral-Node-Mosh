const express = require("express");
const mongoose = require("mongoose");
const { Rental, validate } = require("../models/rental");
const { Customer } = require("../models/customer");
const { Movie } = require("../models/movie");
const auth = require("../middleware/auth");
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

router.post("/", auth, async (req, res) => {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const customer = await Customer.findById(value.customerId);
  if (!customer) return res.status(400).send("Invalid Customer Id");

  const movie = await Movie.findById(value.movieId);
  if (!movie) return res.status(400).send("Invalid Movie Id");

  // Validate the snapshot before changing stock.
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
  await rental.validate();

  // This single-document update is atomic, even on standalone MongoDB.
  const result = await Movie.updateOne(
    { _id: movie._id, numberInStock: { $gte: 1 } },
    { $inc: { numberInStock: -1 } },
  );
  if (result.matchedCount !== 1) {
    return res.status(400).send("Movie is not in stock");
  }

  try {
    await rental.save();
  } catch (err) {
    // Best-effort compensation, not a transaction: crashes or network failures
    // can still leave the rental and stock inconsistent.
    try {
      const restored = await Movie.updateOne(
        { _id: movie._id },
        { $inc: { numberInStock: 1 } },
      );
      if (restored.matchedCount !== 1) {
        throw new Error("Movie not found while restoring stock");
      }
    } catch (restoreError) {
      console.error("Could not restore stock after rental save failed", {
        movieId: String(movie._id),
        rentalId: String(rental._id),
        error: restoreError,
      });
    }
    throw err;
  }

  res.status(201).send(rental);
});

module.exports = router;
