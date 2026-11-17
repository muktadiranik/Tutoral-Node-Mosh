const { Movie, validate } = require("../models/movie");
const { Genre } = require("../models/genre");
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();

function validateMovie(req, res, next) {
  const { error, value } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  req.body = value;
  next();
}

router.param("id", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(404).send("Movie not found");
  }

  next();
});

router.get("/", async (req, res) => {
  const movies = await Movie.find().sort({ title: 1 });
  res.send(movies);
});

router.get("/:id", async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) return res.status(404).send("Movie not found");

  res.send(movie);
});

router.post("/", validateMovie, async (req, res) => {
  const genre = await Genre.findById(req.body.genreId);
  if (!genre) return res.status(400).send("Invalid Genre Id");

  const movie = await Movie.create({
    title: req.body.title,
    genre: {
      _id: genre._id,
      name: genre.name,
    },
    numberInStock: req.body.numberInStock,
    dailyRentalRate: req.body.dailyRentalRate,
  });
  res.status(201).send(movie);
});

router.put("/:id", validateMovie, async (req, res) => {
  const genre = await Genre.findById(req.body.genreId);
  if (!genre) return res.status(400).send("Invalid Genre Id");

  const movie = await Movie.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title: req.body.title,
        genre: { _id: genre._id, name: genre.name },
        numberInStock: req.body.numberInStock,
        dailyRentalRate: req.body.dailyRentalRate,
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!movie) return res.status(404).send("Movie not found");

  res.send(movie);
});

router.delete("/:id", async (req, res) => {
  const movie = await Movie.findByIdAndDelete(req.params.id);
  if (!movie) return res.status(404).send("Movie not found");

  res.send(movie);
});

module.exports = router;
