const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { Genre, validateGenre } = require("../models/genre");

router.param("id", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(404).send("Genre not found");
  }

  next();
});

router.get("/", async (req, res) => {
  const genres = await Genre.find();
  res.send(genres);
});

router.get("/:id", async (req, res) => {
  const genre = await Genre.findById(req.params.id);
  if (!genre) return res.status(404).send("Genre not found");

  res.send(genre);
});

router.post("/", validateGenre, async (req, res) => {
  const genre = await Genre.create({ name: req.body.name });
  res.status(201).send(genre);
});

router.put("/:id", validateGenre, async (req, res) => {
  const genre = await Genre.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name } },
    { returnDocument: "after", runValidators: true },
  );
  if (!genre) return res.status(404).send("Genre not found");

  res.send(genre);
});

router.delete("/:id", async (req, res) => {
  const genre = await Genre.findByIdAndDelete(req.params.id);
  if (!genre) return res.status(404).send("Genre not found");

  const genres = await Genre.find();
  res.send(genres);
});

module.exports = router;
