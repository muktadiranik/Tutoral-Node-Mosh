const express = require("express");
const Joi = require("joi");
const router = express.Router();
const courses = require("../data/courses");

let nextCourseId = Math.max(0, ...courses.map((course) => course.id)) + 1;

const schema = Joi.object({
  name: Joi.string().min(3).required(),
}).required();

function validateCourse(req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
}

router.param("id", (req, res, next, id) => {
  const course = courses.find((c) => c.id === Number(id));

  if (!course) {
    return res.status(404).send("Course not found");
  }

  req.course = course;
  next();
});

router.get("/", (req, res) => {
  res.send(courses);
});

router.get("/:id", (req, res) => {
  res.send(req.course);
});

router.post("/", validateCourse, (req, res) => {
  const course = {
    id: nextCourseId++,
    name: req.body.name,
  };
  courses.push(course);
  res.status(201).send(course);
});

router.put("/:id", validateCourse, (req, res) => {
  const course = req.course;

  course.name = req.body.name;
  res.status(200).send(course);
});

router.delete("/:id", (req, res) => {
  const course = req.course;

  const index = courses.indexOf(course);
  courses.splice(index, 1);

  res.status(200).send(course);
});

module.exports = router;
