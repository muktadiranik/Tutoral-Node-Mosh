const fs = require("fs");

console.log(fs.readdirSync("./"));
console.log(
  fs.readdir("./", function (error, files) {
    if (error) console.log(error);
    else console.log(files);
  }),
);
