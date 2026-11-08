const express = require("express");
const router = express.Router();
const courses = require("../data/courses");

router.get("/", (req, res) => {
  res.render("index", {
    title: "My First Pug Template",
    content: "Welcome to my first Pug template",
    courses,
  });
});

module.exports = router;
