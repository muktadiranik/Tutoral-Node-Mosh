var url = "https://api.example.com/log";
const EventEmitter = require("events");

function log(message) {
  console.log(message);
}

const add = (a, b) => a + b;
const sub = (a, b) => a - b;
const mul = (a, b) => a * b;
const div = (a, b) => a / b;

module.exports.log = log;
module.exports.add = add;
module.exports.sub = sub;
module.exports.mul = mul;
module.exports.div = div;
module.exports.url = url;

class Logger extends EventEmitter {
  log(message) {
    console.log(message);
    this.emit("message logged", { id: 1, message });
  }
}

module.exports.printLogger = Logger;

(function (exports, require, module, __filename, __dirname) {
  console.log(exports);
  console.log(require);
  function log(message) {
    console.log(message);
  }

  module.exports.log = log;
});

console.log(exports);
console.log(require);
