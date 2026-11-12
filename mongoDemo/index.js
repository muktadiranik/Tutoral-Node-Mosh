const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/Tutorial")
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Could not connect to MongoDB" + err);
  });

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true, minlength: 5, maxlength: 255 },
  author: { type: String, required: true, enum: ["Mosh", "John", "Hamedani"] },
  tags: [
    {
      isAsync: true,
      type: Array,
      validate: {
        validator: function (value, callback) {
          setTimeout(() => {
            const result = value && value.length > 0;
            console.log("Async operation inside validation");
          }, 1000);
          callback(result);
          return value && value.length > 0;
        },
        message: "A course should have at least one tag",
      },
    },
  ],
  date: { type: Date, default: Date.now },
  isPublished: { type: Boolean, required: true },
  price: {
    type: Number,
    required: function () {
      return this.isPublished;
    },
    min: 1,
    max: 5000,
  },
});

const Course = mongoose.model("Course", courseSchema);

async function createCourse() {
  const course1 = new Course({
    name: "Angular Course",
    author: "Mosh",
    tags: ["angular", "frontend"],
    isPublished: true,
    price: 100,
  });

  const course2 = new Course({
    name: "Node.js Course",
    author: "Mosh",
    tags: ["backend", "node.js"],
    isPublished: true,
    price: 150,
  });

  const course3 = new Course({
    name: "Express.js Course",
    author: "Mosh",
    tags: ["backend", "node.js"],
    isPublished: true,
    price: 200,
  });

  const course4 = new Course({
    name: "React Course",
    author: "Mosh",
    tags: ["frontend", "react"],
    isPublished: true,
    price: 250,
  });

  const course5 = new Course({
    name: "JavaScript Course",
    author: "Mosh",
    tags: ["frontend", "javascript"],
    isPublished: true,
    price: 300,
  });

  const course6 = new Course({
    name: "MongoDB Course",
    author: "Mosh",
    tags: ["database", "mongodb"],
    isPublished: true,
    price: 350,
  });

  const course7 = new Course({
    name: "Express.js Course",
    author: "Mosh",
    tags: ["backend", "node.js"],
    isPublished: true,
    price: 400,
  });

  const course8 = new Course({
    name: "React Course",
    author: "Mosh",
    tags: ["frontend", "react"],
    isPublished: true,
    price: 450,
  });

  const course9 = new Course({
    name: "JavaScript Course",
    author: "Mosh",
    tags: ["frontend", "javascript"],
    isPublished: true,
    price: 500,
  });

  const course10 = new Course({
    name: "MongoDB Course",
    author: "Mosh",
    tags: ["database", "mongodb"],
    isPublished: true,
    price: 550,
  });
  try {
    const courseArray = [
      course1,
      course2,
      course3,
      course4,
      course5,
      course6,
      course7,
      course8,
      course9,
      course10,
    ];

    for (const course of courseArray) {
      await course.validate();
    }

    const result = await Course.insertMany([
      course1,
      course2,
      course3,
      course4,
      course5,
      course6,
      course7,
      course8,
      course9,
      course10,
    ]);
    console.log(result);
  } catch (ex) {
    console.log(ex.message);
    for (field in ex.errors) {
      console.log(ex.errors[field].message);
    }
  }
}

// createCourse();

async function getCourses() {
  // eq (equal)
  // ne (not equal)
  // gt (greater than)
  // gte (greater than or equal)
  // lt (less than)
  // lte (less than or equal)
  // in
  // nin (not in)
  // or
  // and
  /**
   * Pagination logic
   * const pageNumber = 2;
   * const pageSize = 10;
   * const skip = (pageNumber - 1) * pageSize;
   */
  const pageNumber = 2;
  const pageSize = 10;
  const skip = (pageNumber - 1) * pageSize;

  const courses = await Course.find({
    name: "React Course",
    isPublished: true,
  })
    .find({
      author: "Mosh",
      isPublished: true,
      price: { $gte: 10 },
      tags: { $in: ["frontend", "react"] },
    })
    // Starts with Mosh
    .find({ author: /^Mosh/i })
    // Ends with Hamedani
    .find({ author: /Hamedani$/i })
    // Contains Mosh
    .find({ author: /.*Mosh.*/i })
    .or({ author: "Mosh" }, { isPublished: true })
    .and({ author: "Mosh" }, { isPublished: true })
    .limit(pageSize)
    .skip(skip)
    .sort({ name: -1 })
    .select({ name: -1, tags: 1 });
  console.log(courses);
}

getCourses();

async function getCoursesCount() {
  // eq (equal)
  // ne (not equal)
  // gt (greater than)
  // gte (greater than or equal)
  // lt (less than)
  // lte (less than or equal)
  // in
  // nin (not in)
  // or
  // and
  const courses = await Course.find({
    name: "React Course",
    isPublished: true,
  })
    .find({
      author: "Mosh",
      isPublished: true,
      price: { $gte: 100 },
      tags: { $in: ["frontend", "react"] },
    })
    // Starts with Mosh
    .find({ author: /^Mosh/i })
    // Ends with Hamedani
    .find({ author: /Hamedani$/i })
    // Contains Mosh
    .find({ author: /.*Mosh.*/i })
    .or({ author: "Mosh" }, { isPublished: true })
    .and({ author: "Mosh" }, { isPublished: true })
    .limit(5)
    .sort({ name: -1 })
    .countDocuments();
  console.log(courses);
}

getCoursesCount();

async function getSpecificCourses() {
  const pageNumber = 1;
  const pageSize = 10;
  const skip = (pageNumber - 1) * pageSize;

  const courses = await Course.find({
    isPublished: true,
    tags: { $in: ["frontend", "react"] },
  })
    .sort({ price: -1 })
    .select({ name: 1, author: 1, price: 1 })
    .limit(pageSize)
    .skip(skip);
  console.log(courses);
}

getSpecificCourses();

async function getCoursesWithSpeciedPrice() {
  const courses = await Course.find({
    isPublished: true,
  }).or([
    { price: { $gte: 150 } },
    { price: { $lte: 200 }, name: /.*Course.*/i },
  ]);
  console.log(courses);
}

getCoursesWithSpeciedPrice();

async function updateCourse(id) {
  const course = await Course.findById(id);
  if (!course) return null;

  await course.updateOne({
    $set: {
      author: "Hamedani",
      isPublished: false,
    },
  });
  console.log(course);
  return course;
}

updateCourse("6af4ede821a762f55fadd9b8");

async function updateCourseThenGet(id) {
  const course = await Course.findByIdAndUpdate(
    id,
    {
      $set: {
        isPublished: true,
        author: "Hamedani",
      },
    },
    { returnDocument: "after" },
  );
  console.log(course);
  return course;
}

updateCourseThenGet("6af4ede821a762f55fadd9b9");

async function removeCourse(id) {
  const course = Course.findByIdAndDelete(id);
  console.log(course);
  return course;
}

removeCourse("6af4ede821a762f55fadd9b8");

async function removeCourseFindOneAndDelete(id) {
  const course = Course.findOneAndDelete(id);
  console.log(course);
  return course;
}

removeCourseFindOneAndDelete("6af4ede821a762f55fadd9b9");

const random = new Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);

for (const element of random) {
  console.log(element);
}

const randomObject = [
  {
    id: 1,
    name: "Mosh",
  },
  {
    id: 2,
    name: "Hamedani",
  },
  {
    id: 3,
    name: "Hamedani",
  },
  {
    id: 4,
    name: "Hamedani",
  },
  {
    id: 5,
    name: "Hamedani",
  },
  {
    id: 6,
    name: "Hamedani",
  },
  {
    id: 7,
    name: "Hamedani",
  },
  {
    id: 8,
    name: "Hamedani",
  },
];

for (const key in randomObject) {
  const element = object[key];
  console.log(element);
}
