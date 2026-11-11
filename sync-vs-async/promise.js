// const resolvedPromise = new Promise((resolve, reject) => {
//   setTimeout(() => {
//     resolve("hello world");
//   }, 1000);
// });

// const rejectedPromise = new Promise((resolve, reject) => {
//   setTimeout(() => {
//     reject(new Error("error"));
//   }, 2000);
// });

// resolvedPromise
//   .then((result) => {
//     console.log(result);
//     return result + "!";
//   })
//   .then((result) => {
//     console.log(result);
//     return result + "!";
//   })
//   .catch(() => {
//     rejectedPromise
//       .then((result) => {
//         console.log(result);
//         return result + "!";
//       })
//       .catch((error) => {
//         console.log(error.message);
//         return error + "!";
//       });
//   })
//   .finally(() => {
//     console.log("finally");
//   });

const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve("Asynchronus operation 1");
  }, 1000);
});

const p2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve("Asynchnus operation 2");
  }, 2000);
});

const p3 = new Promise((resolve, reject) => {
  reject(new Error("Error asynchnus operation 1"));
});

Promise.all([p1, p2, p3])
  .then((result) => {
    console.log(result);
    return result + "!";
  })
  .catch((error) => {
    setTimeout(() => {
      console.log(error.message);
      return error + "!";
    }, 1500);
  });

Promise.race([p1, p2, p3])
  .then((result) => {
    console.log(result);
    return result + "!";
  })
  .catch((error) => {
    console.log(error.message);
    return error + "!";
  });

async function displayResults() {
  try {
    const p1Result = await p1;
    console.log(p1Result);
    const p2Result = await p2;
    console.log(p2Result);
    const p3Result = await p3;
    console.log(p3Result);
  } catch (error) {
    console.log(error.message);
  }
}

displayResults();
