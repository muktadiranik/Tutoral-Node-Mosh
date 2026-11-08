const express = require("express");
const Joi = require("joi");
const router = express.Router();
const coursesRouter = express.Router();

const schema = Joi.object({
  name: Joi.string().min(3).required(),
}).required();

const courses = [
  { id: 1, name: "C" },
  { id: 2, name: "C++" },
  { id: 3, name: "C#" },
  { id: 4, name: "Java" },
  { id: 5, name: "Python" },
  { id: 6, name: "JavaScript" },
  { id: 7, name: "React" },
  { id: 8, name: "Angular" },
  { id: 9, name: "Node.js" },
  { id: 10, name: "Express.js" },
];

function validateCourse(req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
}

router.get("/", (req, res) => {
  res.render("index", {
    title: "My First Pug Template",
    content: "Welcome to my first Pug template",
    courses,
  });
});

coursesRouter.param("id", (req, res, next, id) => {
  const course = courses.find((c) => c.id === Number(id));

  if (!course) {
    return res.status(404).send("Course not found");
  }

  req.course = course;
  next();
});

coursesRouter.get("/", (req, res) => {
  res.send(courses);
});

coursesRouter.get("/:id", (req, res) => {
  res.send(req.course);
});

coursesRouter.post("/", validateCourse, (req, res) => {
  const course = {
    id: courses.length + 1,
    name: req.body.name,
  };
  courses.push(course);
  res.status(201).send(course);
});

coursesRouter.put("/:id", validateCourse, (req, res) => {
  const course = req.course;

  course.name = req.body.name;
  res.status(200).send(course);
});

coursesRouter.delete("/:id", (req, res) => {
  const course = req.course;

  const index = courses.indexOf(course);
  courses.splice(index, 1);

  res.status(200).send(course);
});

router.use("/api/courses", coursesRouter);

module.exports = router;
