const jwt = require("jsonwebtoken");
const express = require("express");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const config = require("config");
const router = express.Router();
const { User } = require("../models/user");

const validate = function (req, res, next) {
  const schema = Joi.object({
    email: Joi.string().trim().min(1).max(255).email().required(),
    password: Joi.string().trim().required(),
  }).required();

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
};

router.post("/", validate, async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("Invalid email or password!");

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) return res.status(400).send("Invalid email or password!");

  const token = user.generateAuthToken();

  res.send(token);
});

module.exports = router;
