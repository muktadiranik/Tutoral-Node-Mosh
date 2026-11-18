const mongoose = require("mongoose");

const id = new mongoose.Types.ObjectId();

console.log(id);
console.log(id.getTimestamp());

const isValid = mongoose.Types.ObjectId.isValid(123456);
console.log(isValid);
