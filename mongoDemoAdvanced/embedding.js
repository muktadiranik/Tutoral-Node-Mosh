const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/playground")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Could not connect to MongoDB", err));

const authorSchema = new mongoose.Schema({
  name: String,
  bio: String,
  website: String,
});

const Author = mongoose.model("Author", authorSchema);

const Course = mongoose.model(
  "Course",
  new mongoose.Schema({
    name: String,
    author: {
      type: authorSchema,
      required: true,
    },
  }),
);

const CourseWithMultipleAuthor = mongoose.model(
  "CourseWithMultipleAuthor",
  new mongoose.Schema({
    name: String,
    authors: [
      {
        type: authorSchema,
        required: true,
      },
    ],
  }),
);

async function createAuthor(author) {
  const result = await author.save();
  console.log(result);
  return result;
}

async function createCourse(name, author) {
  const course = new Course({
    name: name,
    author: author,
  });

  const result = await course.save();
  console.log(result);
  return result;
}

async function createCourseWithMultipleAuthors(name, authors) {
  const course = new CourseWithMultipleAuthor({
    name: name,
    authors: authors,
  });

  const result = await course.save();
  console.log(result);
  return result;
}

// createCourseWithMultipleAuthors("Node.js Course", [
//   new Author({
//     name: "Mosh",
//     bio: "Bio",
//     website: "www.mosh.com",
//   }),
//   new Author({
//     name: "John",
//     bio: "Bio",
//     website: "www.john.com",
//   }),
// ]);

async function addAuthorToCourse(courseId, author) {
  const course = await CourseWithMultipleAuthor.findById(courseId);
  course.authors.push(author);
  await course.save();
}

addAuthorToCourse(
  "6afb03a2cf7ab75be566d9f4",
  new Author({
    name: "Hamedani",
    bio: "Bio",
    website: "www.codewithmosh.com",
  }),
);

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

async function removeAuthorFromCourse(courseId, authorId) {
  const course = await CourseWithMultipleAuthor.findById(courseId);
  const author = course.authors.id(authorId);
  author.deleteOne();
  course.save();
}

removeAuthorFromCourse("6afb02fc94145f44e5ed6457", "6afb02fc94145f44e5ed6455");

async function getAuthor() {
  const author = await Author.findOne({ name: "Mosh" });
  console.log(author);
  return author;
}

async function getCourses() {
  const courses = await Course.find();
  console.log(courses);
  return courses;
}

async function getCourse(id) {
  const course = await Course.findOne({ _id: id }).select({
    name: 1,
    author: 1,
  });
  console.log(course);
  return course;
}

getCourse("6af98761d3436429946b4ef1");

getCourses();

async function updateAuthor(courseId) {
  const course = await Course.findById(courseId);
  course.author.name = "Mosh Hamedani";
  const result = await course.save();
  console.log(result);
  return result;
}

updateAuthor("6af98761d3436429946b4ef1");

async function updateAuthorDirectly(courseId) {
  const result = await Course.updateOne(
    { _id: courseId },
    {
      $set: {
        "author.name": "Mosh",
      },
    },
  );
  console.log(result);
  return result;
}

updateAuthorDirectly("6af98761d3436429946b4ef1");

async function updateAuthorUnsetDirectly(courseId) {
  const result = await Course.updateOne(
    { _id: courseId },
    {
      $unset: {
        author: "",
      },
    },
  );
}

updateAuthorUnsetDirectly("6af98761d3436429946b4ef1");
