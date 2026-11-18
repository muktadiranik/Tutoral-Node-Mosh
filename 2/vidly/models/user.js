const mongoose = require("mongoose");
const Joi = require("joi");

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: 1,
      maxLength: 255,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      minLength: 1,
      maxLength: 255,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
  }),
);

const schema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  email: Joi.string().trim().min(1).max(255).email().required(),
  password: Joi.string().trim().required(),
}).required();

const validateUser = function (req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
};

User.User = User;
User.validateUser = validateUser;

module.exports = User;
module.exports.validateUser = validateUser;
