// Trade off between query performance vs consistency
// Consistency: 1. Strong 2. Weak 3. Eventual
// Strong: 1. Read Consistency 2. Write Consistency
// Weak: 1. Read Consistency 2. Write Acks
// Eventual: 1. Read Acks 2. Write Acks
// Uaing references: 1. Author is a reference to the author object
// Normalization - consistency
let author = {
  name: "Mosh Hamedani",
};

let course = {
  author: "id",
};

course = {
  author: "id",
  authors: ["id1", "id2"],
};
// Strong Consistency: 1. Read Consistency 2. Write Consistency
// Write Consistency: 1. All writes are immediately visible to all readers
// Read Consistency: 1. All reads are immediately visible to all readers
// Eventual Consistency: 1.
// Denormalization: Using embeded documents, gives performance benefits
course = {
  author: {
    name: "Mosh Hamedani",
  },
};

// Hybrid Technquechnique
author = {
  name: "Mosh hamedani",
  // Other properties
};

course = {
  author: {
    id: "reference",
    name: "Mosh Hamedani",
  },
};
