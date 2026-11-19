const config = require("config");

module.exports = function () {
  const jwtPrivateKey = config.has("jwtPrivateKey")
    ? config.get("jwtPrivateKey")
    : "";
  if (typeof jwtPrivateKey !== "string" || !jwtPrivateKey.trim()) {
    console.error(
      "JWT private key not specified. Set vidly_jwtPrivateKey in the terminal before starting Vidly.",
    );
    process.exit(1);
  }
};
