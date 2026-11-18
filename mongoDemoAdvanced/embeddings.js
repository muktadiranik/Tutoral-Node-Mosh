const mongoose = require("mongoose");

const authorSchema = new mongoose.Schema({
  name: String,
  bio: String,
  website: String,
});

const Course = mongoose.model(
  "Course",
  new mongoose.Schema({
    name: String,
    // Each author is embedded in the course and receives its own _id.
    authors: [authorSchema],
  }),
);

async function createCourse(name, authors) {
  if (!Array.isArray(authors)) {
    throw new TypeError("authors must be an array of author objects");
  }

  // Embedded authors are saved with the course, not in a separate collection.
  const course = new Course({ name, authors });
  const result = await course.save();
  console.log(result);
  return result;
}

async function createCourseThenAuthors() {
  return createCourse("Node.js Course", [
    { name: "Mosh", bio: "Node.js instructor", website: "www.mosh.com" },
    { name: "John", bio: "Guest instructor", website: "www.example.com" },
  ]);
}

async function getCourses() {
  const courses = await Course.find().select({ name: 1, authors: 1 });
  console.log(courses);
  return courses;
}

async function getCourse(courseId) {
  const course = await Course.findById(courseId).select({ name: 1, authors: 1 });
  console.log(course);
  return course;
}

async function getAuthor(courseId, authorId) {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const author = course.authors.id(authorId);
  console.log(author);
  return author;
}

async function updateAuthor(courseId, authorId, name) {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const author = course.authors.id(authorId);
  if (!author) return null;

  author.name = name;
  // Saving the parent persists changes to its embedded authors.
  const result = await course.save();
  console.log(result);
  return result;
}

async function updateAuthorDirectly(courseId, authorId, name) {
  const result = await Course.updateOne(
    { _id: courseId, "authors._id": authorId },
    {
      // $ identifies the array element matched by authors._id.
      $set: { "authors.$.name": name },
    },
    { runValidators: true },
  );

  // updateOne returns matchedCount/modifiedCount, not the updated course.
  console.log(result);
  return result;
}

async function addAuthor(courseId, author) {
  const course = await Course.findById(courseId);
  if (!course) return null;

  course.authors.push(author);
  const result = await course.save();
  console.log(result);
  return result;
}

async function removeAuthor(courseId, authorId) {
  const course = await Course.findById(courseId);
  if (!course) return null;

  const author = course.authors.id(authorId);
  if (!author) return null;

  // Remove the array element instead of using $unset, which can leave a null slot.
  author.deleteOne();
  const result = await course.save();
  console.log(result);
  return result;
}

async function main() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/playground",
    );
    console.log("Connected to MongoDB");

    // Uncomment this block to create and modify a sample course in sequence.
    // const course = await createCourseThenAuthors();
    // const authorId = course.authors[0]._id;
    // await updateAuthor(course._id, authorId, "Mosh Hamedani");
    // await updateAuthorDirectly(course._id, authorId, "Mosh");
    // await addAuthor(course._id, { name: "Jane", bio: "Guest author" });
    // await removeAuthor(course._id, course.authors[1]._id);
    // await getCourse(course._id);

    // Reading does not migrate old documents with a singular author field.
    await getCourses();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Could not run the embedded authors example:", err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  Course,
  createCourse,
  createCourseThenAuthors,
  getCourses,
  getCourse,
  getAuthor,
  updateAuthor,
  updateAuthorDirectly,
  addAuthor,
  removeAuthor,
};
