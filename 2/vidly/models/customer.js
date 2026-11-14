const mongoose = require("mongoose");
const Joi = require("joi");

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minLength: 5,
    maxLength: 255,
  },
  isGold: {
    type: Boolean,
    default: false,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    minLength: 5,
    maxLength: 255,
  },
});

const Customer = mongoose.model("Customer", customerSchema);

const schema = Joi.object({
  name: Joi.string().trim().min(5).max(255).required(),
  phone: Joi.string().trim().min(5).max(255).required(),
  isGold: Joi.boolean().default(false),
}).required();

const validateCustomer = function (req, res, next) {
  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  req.body = value;
  next();
};

Customer.Customer = Customer;
Customer.validateCustomer = validateCustomer;

module.exports = Customer;
module.exports.Customer = Customer;
module.exports.validateCustomer = validateCustomer;
