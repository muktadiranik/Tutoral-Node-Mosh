// Synchronous code runs immediately, before any of the timer callbacks.
console.log("before");
// Schedule work for later without blocking the code that follows.
setTimeout(() => {
  console.log("in setTimeout block");
}, 2000);
// This prints before "in setTimeout block" because setTimeout does not wait.
console.log("after");

// Running promises in parallel
// Promise executors run immediately, so these four timers start independently.
// Their waiting periods overlap; JavaScript callbacks still run one at a time.
// The reject parameter is unused in this success-only example.
const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    console.log("in p1");
    // Fulfill this promise and make "p1" available to its consumers.
    resolve("p1");
  }, 500);
});

// This operation starts without waiting for p1 to finish.
const p2 = new Promise((resolve) => {
  setTimeout(() => {
    console.log("async operation 1");
    resolve("p2");
  }, 1000);
});

// This promise takes longer than p1, so it will not win the race below.
const p3 = new Promise((resolve) => {
  setTimeout(() => {
    console.log("async operation 2");
    resolve("p3");
  }, 1500);
});

// resolve is the first argument; this failure example only uses reject.
const p4 = new Promise((resolve, reject) => {
  setTimeout(() => {
    console.log("async operation 3");
    // Deliberately fail to demonstrate the Promise.all rejection handler.
    reject("p4");
  }, 2000);
});

// Observe the existing promises; Promise.all does not start their timers.
// It succeeds only if all promises fulfill, and rejects if any one rejects.
Promise.all([p1, p2, p3, p4])
  // On success, results keep input order, not the order promises finished in.
  .then((result) => {
    console.log(result);
  })
  // p4 rejects, so this handler runs instead of the success handler above.
  .catch((err) => {
    console.log(err);
    console.log("in catch block");
  });

// Reuse the same promises: their operations are not restarted or duplicated.
// The first promise to settle wins; other operations are NOT cancelled.
Promise.race([p1, p2, p3, p4])
  // p1 fulfills first after about 500 ms, so result is "p1".
  .then((result) => {
    console.log(result);
  })
  // Handles a rejected race or an error thrown in the success handler.
  // p4's later rejection cannot change this race's already-fulfilled result.
  .catch((err) => {
    console.log(err);
    console.log("in catch block");
  });

/**
 * Callbacks
 */
// These dependent operations run in sequence, taking about 13 seconds total.
console.log("callbacks before");
// Pass the function itself, not onUserLoaded(): getUser calls it when ready.
// Function declarations are hoisted, so getUser may be defined further below.
getUser(1, onUserLoaded);
// This prints immediately; it does not wait for the callback chain to finish.
console.log("callbacks after");

// Use distinct handler names: a second getRepositories declaration would
// replace the fetching function, not create an overload with different arguments.
function onUserLoaded(user) {
  console.log(user);
  // The user is now available; pass both it and the next callback.
  getRepositories(user, onRepositoriesLoaded);
}

function onRepositoriesLoaded(userWithRepositories) {
  console.log(userWithRepositories);
  // Wait until repositories exist before starting the commits operation.
  getCommits(userWithRepositories, onCommitsLoaded);
}

function onCommitsLoaded(userWithCommits) {
  console.log(userWithCommits);
  // Start comments only after commits arrive; pass the final handler too.
  getComments(userWithCommits, onCommentsLoaded);
}

function onCommentsLoaded(userWithComments) {
  // The chain ends here with the combined user, repositories, commits and comments.
  console.log(userWithComments);
}

function getUser(id, callback) {
  // Simulate a 2500 ms lookup; the result arrives through callback, not return.
  setTimeout(() => {
    console.log("in getUser");
    // Calling callback passes this object to onUserLoaded's user parameter.
    callback({
      id: id,
      name: "John",
      job: "architect",
    });
  }, 2500);
}

function getRepositories(user, callback) {
  // This timer starts only when onUserLoaded calls getRepositories.
  setTimeout(() => {
    console.log("in getRepositories");
    // Catch synchronous errors inside this timer, including callback invocation.
    // Errors in later timer callbacks are outside this try/catch.
    try {
      // Preserve the user fields and add repositories for the next stage.
      callback({
        id: user.id,
        name: user.name,
        job: user.job,
        repositories: ["repo1", "repo2", "repo3"],
      });
    } catch (err) {
      // Log the error; this demonstration does not forward it to another callback.
      console.log(err);
    }
  }, 3000);
}

function getCommits(repositories, callback) {
  // repositories is the combined object from the previous stage, not just an array.
  setTimeout(() => {
    console.log("in getCommits");
    // Keep the earlier data and attach commits before invoking onCommitsLoaded.
    callback({
      id: repositories.id,
      name: repositories.name,
      job: repositories.job,
      repositories: repositories.repositories,
      commits: ["commit1", "commit2", "commit3"],
    });
  }, 3500);
}

function getComments(commits, callback) {
  // commits contains the accumulated data produced by getCommits.
  setTimeout(() => {
    console.log("in getComments");
    // Deliver the final combined object to onCommentsLoaded.
    callback({
      id: commits.id,
      name: commits.name,
      job: commits.job,
      repositories: commits.repositories,
      commits: commits.commits,
      comments: ["comment1", "comment2", "comment3"],
    });
  }, 4000);
}
