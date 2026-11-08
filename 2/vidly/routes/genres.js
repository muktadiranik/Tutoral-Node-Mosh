const express = require("express");
const router = express.Router();
const Joi = require("joi");
const genres = require("../data/genres");

let nextGenreId = Math.max(0, ...genres.map((genre) => genre.id)) + 1;

const schema = Joi.object({
  name: Joi.string().min(3).required(),
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
  const genre = genres.find((g) => g.id === Number(id));

  if (!genre) {
    return res.status(404).send("Genre not found");
  }

  req.genre = genre;
  next();
});

router.get("/", (req, res) => {
  res.send(genres);
});

router.get("/:id", (req, res) => {
  res.send(req.genre);
});

router.post("/", validateGenre, (req, res) => {
  const genre = {
    id: nextGenreId++,
    name: req.body.name,
  };

  genres.push(genre);
  res.status(201).send(genre);
});

router.put("/:id", validateGenre, (req, res) => {
  const genre = req.genre;
  genre.name = req.body.name;
  res.send(genre);
});

router.delete("/:id", (req, res) => {
  const index = genres.indexOf(req.genre);
  genres.splice(index, 1);
  res.send(genres);
});

module.exports = router;
