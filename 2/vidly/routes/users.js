const express = require("express");
const _ = require("lodash");
const router = express.Router();
const { User, validateUser } = require("../models/user");

router.post("/", validateUser, async (req, res) => {
  if (await User.findOne({ email: req.body.email }))
    return res.status(400).send("User already registered");
  const user = new User(_.pick(req.body, ["name", "email", "password"]));

  const result = await user.save();
  res.send(_.pick(result, ["_id", "name", "email"])); // send only name and email
});

module.exports = router;
