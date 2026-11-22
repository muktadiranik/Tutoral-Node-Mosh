const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const { Genre, validateGenre } = require("../models/genre");
const validateObjectId = require("../middleware/validateObjectId");

router.param("id", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(404).send("Genre not found");
  }

  next();
});

router.get("/", async (req, res) => {
  const genres = await Genre.find();
  res.status(200).send(genres);
});

router.get("/:id", async (req, res) => {
  const genre = await Genre.findById(req.params.id);
  if (!genre) return res.status(404).send("Genre not found");

  res.send(genre);
});

router.post("/", [auth, validateGenre], async (req, res) => {
  const genre = await Genre.create({ name: req.body.name });
  res.status(201).send(genre);
});

router.put("/:id", [auth, validateGenre], async (req, res) => {
  const genre = await Genre.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name } },
    { returnDocument: "after", runValidators: true },
  );
  if (!genre) return res.status(404).send("Genre not found");

  res.send(genre);
});

router.delete("/:id", [auth, admin], async (req, res) => {
  const genre = await Genre.findByIdAndDelete(req.params.id);
  if (!genre) return res.status(404).send("Genre not found");

  const genres = await Genre.find();
  res.send(genres);
});

module.exports = router;
