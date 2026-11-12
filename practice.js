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
