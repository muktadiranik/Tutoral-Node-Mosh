const express = require("express");
const Joi = require("joi");

const app = express();
app.use(express.json());

const schema = Joi.object({
  name: Joi.string().min(3).required(),
});

const validateGenre = function (req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    res.status(400).send(error.details[0].message);
    return;
  }

  res.body = value;
  next();
};

const genres = [
  {
    id: 1,
    name: "Action",
  },
  {
    id: 2,
    name: "Comedy",
  },
  {
    id: 3,
    name: "Drama",
  },
  {
    id: 4,
    name: "Horror",
  },
  {
    id: 5,
    name: "Romance",
  },
  {
    id: 6,
    name: "Thriller",
  },
];

app.get("/api/genres/", (req, res) => {
  res.send(genres);
});

app.get("/api/genres/:id", (req, res) => {
  const genre = genres.find((g) => g.id === parseInt(req.params.id));
  if (!genre) {
    res.status(404).send("Genre not found");
  }
  res.send(genre);
});

app.post("/api/genres/", validateGenre, (req, res) => {
  const genre = {
    id: genres.length + 1,
    name: req.body.name,
  };

  genres.push(genre);
  res.status(201).send(genre);
});

app.put("/api/genres/:id", validateGenre, (req, res) => {
  const genre = genres.find((g) => g.id === parseInt(req.params.id));
  if (!genre) {
    res.status(404).send("Genre not found");
  }
  genre.name = req.body.name;
  res.send(genre);
});

app.delete("/api/genres/:id", (req, res) => {
  const genre = genres.find((g) => g.id === parseInt(req.params.id));

  if (!genre) {
    res.status(404).send("Genre not found");
  }

  genres.splice(genre, 1);
  res.send(genres);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
