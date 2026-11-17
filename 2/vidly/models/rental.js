const Joi = require("joi");
const mongoose = require("mongoose");

const Rental = new mongoose.model(
  "Rental",
  new mongoose.Schema({
    customer: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 255,
    },
    isGold: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 255,
    },
    movie: {
      type: new mongoose.Schema({
        title: {
          type: String,
          required: true,
          minlength: 5,
          maxlength: 255,
        },
        dailyRentalRate: {
          type: Number,
          required: true,
          min: 0,
          max: 255,
        },
      }),
      required: true,
    },
    dateOut: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dateReturned: {
      type: Date,
      default: null,
    },
    rentalFee: {
      type: Number,
      required: true,
      min: 0,
    },
  }),
);

const schema = Joi.object({
  customerId: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required(),
  movieId: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required(),
}).required();

function validateRental(rental) {
  return schema.validate(rental);
}

exports.Rental = Rental;
exports.validate = validateRental;
