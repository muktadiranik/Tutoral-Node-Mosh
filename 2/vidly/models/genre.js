const mongoose = require("mongoose");

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minLength: 5,
    maxLength: 255,
  },
});

module.exports = mongoose.model("Genre", genreSchema);
