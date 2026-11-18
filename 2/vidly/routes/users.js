const express = require("express");
const _ = require("lodash");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("config");
const router = express.Router();
const { User, validateUser } = require("../models/user");

router.post("/", validateUser, async (req, res) => {
  if (await User.findOne({ email: req.body.email }))
    return res.status(400).send("User already registered");
  const user = new User(_.pick(req.body, ["name", "email", "password"]));

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);

  const result = await user.save();

  const token = user.generateAuthToken();

  res
    .header("x-auth-token", token)
    .send(_.pick(result, ["_id", "name", "email"])); // send only name and email
});

module.exports = router;
