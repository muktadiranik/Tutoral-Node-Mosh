const mongoose = require("mongoose");
const Joi = require("joi");

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minLength: 5,
    maxLength: 255,
  },
});

const Genre = mongoose.model("Genre", genreSchema);

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

Genre.Genre = Genre;
Genre.validateGenre = validateGenre;

module.exports = Genre;
module.exports.validateGenre = validateGenre;
