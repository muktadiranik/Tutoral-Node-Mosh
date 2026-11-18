const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/playground")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Could not connect to MongoDB", err));

const Author = mongoose.model(
  "Author",
  new mongoose.Schema({
    name: String,
    bio: String,
    website: String,
  }),
);

const Course = mongoose.model(
  "Course",
  new mongoose.Schema({
    name: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
    },
  }),
);

async function createAuthor(author) {
  const result = await author.save();
  console.log(result);
  return result;
}

async function createCourse(courseName, author) {
  const course = new Course({
    name: courseName,
    author: author,
  });

  const result = await course.save();
  console.log(result);
  return result;
}

async function createCourseThenAuthor() {
  const author = new Author({
    name: "Mosh",
    bio: "Bio",
    website: "www.mosh.com",
  });
  const createdAuthor = await createAuthor(author);
  const createdCourse = await createCourse("Node.js Course", createdAuthor);
}

// createCourseThenAuthor();

async function getAuthor() {
  const author = await Author.findOne({ name: "Mosh" });
  console.log(author);
  return author;
}

async function getCourses() {
  const courses = await Course.find().populate("author", "name -_id");
  console.log(courses);
  return courses;
}

async function getCourse(id) {
  const course = await Course.findOne({ _id: id })
    .populate("author", "name -_id")
    .select({
      name: 1,
      author: 1,
    });
  console.log(course);
  return course;
}

getCourse("6af979597abb840db0629384");

getCourses();
