console.log("globaObject");

const timeout = setTimeout(function () {
  console.log("setTimeout");
  clearTimeout(timeout);
}, 1000);

let count = 0;
const interval = setInterval(function () {
  count++;
  console.log("setInterval", count);

  if (count >= 5) {
    clearInterval(interval);
    console.log("Stopped");
  }
}, 1000);
