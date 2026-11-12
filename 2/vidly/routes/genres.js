const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Joi = require("joi");
const Genre = require("../models/genre");

const schema = Joi.object({
  name: Joi.string().trim().min(5).max(255).required(),
}).required();

const validateGenre = function (req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
};

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
