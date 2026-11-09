console.log("before");
setTimeout(() => {
  console.log("in setTimeout block");
}, 2000);
console.log("after");

// Running promises in parallel
const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    console.log("in p1");
    resolve("p1");
  }, 2000);
});

const p2 = new Promise((resolve) => {
  setTimeout(() => {
    console.log("async operation 1");
    resolve("p2");
  }, 1500);
});

const p3 = new Promise((resolve) => {
  setTimeout(() => {
    console.log("async operation 2");
    resolve("p3");
  }, 1000);
});

const p4 = new Promise((resolve, reject) => {
  setTimeout(() => {
    console.log("async operation 3");
    reject("p4");
  }, 2500);
});

Promise.all([p1, p2, p3, p4])
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
    console.log("in catch block");
  });

Promise.race([p1, p2, p3, p4])
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
    console.log("in catch block");
  });

/**
 * Callbacks
 */
console.log("before");
getUser(1, function (user) {
  console.log(user);

  getRepositories(user, function (userWithRepositories) {
    console.log(userWithRepositories);
  });
});
console.log("after");

function getUser(id, callback) {
  setTimeout(() => {
    console.log("in getUser");
    callback({
      id: id,
      name: "John",
      job: "architect",
    });
  }, 2000);
}

function getRepositories(user, callback) {
  setTimeout(() => {
    console.log("in getRepositories");
    try {
      callback({
        id: user.id,
        name: user.name,
        job: user.job,
        repositories: ["repo1", "repo2", "repo3"],
      });
    } catch (err) {
      console.log(err);
    }
  }, 2000);
}
