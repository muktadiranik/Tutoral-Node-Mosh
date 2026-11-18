const Joi = require("joi");
const mongoose = require("mongoose");
const { genreSchema } = require("./genre");

const Movie = mongoose.model(
  "Movie",
  new mongoose.Schema({
    title: {
      type: String,
      required: true,
      minLength: 5,
      maxLength: 255,
      trim: true,
    },
    genre: {
      type: genreSchema,
      required: true,
    },
    numberInStock: {
      type: Number,
      required: true,
      min: 0,
      max: 255,
      validate: {
        validator: Number.isInteger,
        message: "numberInStock must be an integer",
      },
    },
    dailyRentalRate: {
      type: Number,
      required: true,
      min: 0,
      max: 255,
    },
  }),
);

const schema = Joi.object({
  title: Joi.string().trim().min(5).max(255).required(),
  genreId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .required(),
  dailyRentalRate: Joi.number().min(0).max(255).required(),
}).required();

function validateMovie(movie) {
  return schema.validate(movie);
}

module.exports = { Movie, validate: validateMovie };
