const p1 = Promise.resolve({ id: 1, name: "John", age: 20 });
p1.then((data) => {
  console.log(data);
});

const p2 = Promise.reject(new Error("Error"));
p2.catch((err) => {
  console.log(err);
  console.log(err.message);
});

/**
 * Promises
 */
const p4 = getUser(1);
p1.then((result) => {
  console.log(result);
});
console.log("before");
getUser(1)
  .then((user) => {
    console.log(user);
    setTimeout(() => {
      console.log("in setTimeout");
    }, 1000);
    return getRepositories(user);
  })
  .then((userWithRepositories) => {
    console.log(userWithRepositories);
    return getCommits(userWithRepositories);
  })
  .then((userWithCommits) => {
    console.log(userWithCommits);
  })
  .catch((err) => {
    console.log(err);
  });
console.log("after");

function getUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("in getUser");
      resolve({
        id: id,
        name: "John",
        job: "architect",
      });
    }, 2000);
  });
}

console.log("first");
function getCategory(params) {
  console.log("in getCategory");
}

function getRepositories(user) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("in getRepositories");
      resolve({
        id: user.id,
        name: user.name,
        commits: 100,
      });
    }, 2000);
  });
}

function getCommits(user) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("in getCommits");
      (resolve({
        id: user.id,
        name: user.name,
        commits: user.commits,
      }),
        1500);
    });
  });
}

// Async and await approach
async function displayCommits() {
  const user = await getUser(1);
  console.log(user);
  const repos = await getRepositories(user);
  console.log(repos);
  const commits = await getCommits(repos);
  console.log(commits);
}

displayCommits();

const p5 = Promise.resolve({ id: 1, name: "John", age: 20 });
p5.then((data) => {
  console.log(data);
});

const p6 = Promise.reject(new Error("Error"));
p6.catch((err) => {
  console.log(err.message);
});
