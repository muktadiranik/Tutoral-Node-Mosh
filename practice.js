const random = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

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
  const element = randomObject[key];
  console.log(element);
}

function checkSpeed(speed) {
  if (speed <= 70) {
    console.log("okay");
  } else {
    const points = Math.floor((speed - 70) / 5);
    if (points >= 12) {
      console.log("License suspended");
    } else {
      console.log(`Points: ${points}`);
    }
  }
}
checkSpeed(70);
checkSpeed(75);
checkSpeed(80);
checkSpeed(130);

function printNumber(limits) {
  for (let i = 0; i <= limits; i++) {
    if (i % 2 === 0) {
      console.log(i + " is even");
    } else {
      console.log(i + " is odd");
    }
  }
}
printNumber(10);

function checkTruthyFalsy(arr) {
  let truthyFalsy = [];
  for (const element of arr) {
    if (element) {
      truthyFalsy.push("truthy");
    } else {
      truthyFalsy.push("falsy");
    }
  }
  return truthyFalsy;
}
console.log(
  checkTruthyFalsy([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, false, true, ""]),
);

function printStringObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      console.log(key + " : " + obj[key]);
    }
  }
}
printStringObject({ name: "Mosh", age: 30, city: "New York" });

function multiplesOf3And5(limit) {
  let multiples = [];
  for (let i = 0; i <= limit; i++) {
    if (i % 3 === 0 || i % 5 === 0) {
      multiples.push(i);
    }
  }
  return multiples;
}
console.log(multiplesOf3And5(10));

function printTree(height) {
  for (let i = 1; i <= height; i++) {
    let row = "";
    for (let j = 1; j <= i; j++) {
      row += "*";
    }
    console.log(row);
  }
}
printTree(5);

function printReverseTree(height) {
  for (let i = height; i >= 1; i--) {
    let row = "";
    for (let j = 1; j <= i; j++) {
      row += "*";
    }
    console.log(row);
  }
}
printReverseTree(5);

function printPrimeNumbers(limit) {
  for (let i = 2; i <= limit; i++) {
    let isPrime = true;
    for (let j = 2; j < i; j++) {
      if (i % j === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      console.log(i);
    }
  }
}
printPrimeNumbers(10);
