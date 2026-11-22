const path = require("node:path");

// Configure node-config before loading models that generate authentication tokens.
const jwtPrivateKey = "vidly-node-tests-only-not-for-production";
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, "../vidly/config");
process.env.vidly_jwtPrivateKey = jwtPrivateKey;

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Unstubbed queries must fail immediately rather than wait for MongoDB.
mongoose.set("bufferCommands", false);

function token(claims = {}) {
  return jwt.sign({
    _id: new mongoose.Types.ObjectId().toHexString(),
    isAdmin: false,
    ...claims,
  }, jwtPrivateKey);
}

module.exports = { jwtPrivateKey, token };
