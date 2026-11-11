/**
 * Promises
 */
getUser(1)
  .then((user) => {
    getRepositories(user).then((userWithRepositories) => {
      getCommits(userWithRepositories).then((userWithCommits) => {
        console.log(userWithCommits);
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });

console.log("before");
getUser(1)
  .then((user) => {
    console.log(user);
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
        2000);
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
