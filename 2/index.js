const express = require("express");
const Joi = require("joi");
const app = express();

app.use(express.json());

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

app.get("/", (req, res) => {
  res.send("Hello World");
});

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

app.param("id", (req, res, next, id) => {
  const course = courses.find((c) => c.id === Number(id));

  if (!course) {
    return res.status(404).send("Course not found");
  }

  req.course = course;
  next();
});

app.get("/api/courses/", (req, res) => {
  res.send(courses);
});

app.get("/api/courses/:id", (req, res) => {
  const course = courses.find((c) => c.id === parseInt(req.params.id));
  if (!course) {
    res.status(404).send("Course not found");
    return;
  }
  res.status(200).send(course);
});

app.get("/api/courses/:id", (req, res) => {
  res.send(req.course);
});

app.post("/api/courses/", validateCourse, (req, res) => {
  const course = {
    id: courses.length + 1,
    name: req.body.name,
  };
  courses.push(course);
  res.status(201).send(course);
});

app.put("/api/courses/:id", validateCourse, (req, res) => {
  const course = courses.find((c) => c.id === parseInt(req.params.id));

  if (!course) {
    res.status(404).send("Course not found");
    return;
  }

  course.name = req.body.name;
  res.status(200).send(course);
});

app.delete("/api/courses/:id", (req, res) => {
  const course = courses.find((c) => c.id === parseInt(req.params.id));

  if (!course) {
    res.status(404).send("Course not found");
    return;
  }

  const index = courses.indexOf(course);
  courses.splice(index, 1);

  res.status(200).send(course);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
