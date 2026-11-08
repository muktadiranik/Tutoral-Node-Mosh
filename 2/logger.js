const startup = function (req, res, next) {
  console.log("middleware called");
  next();
};

const authenticate = function (req, res, next) {
  console.log("authentication");
  next();
};

module.exports = { startup, authenticate };
