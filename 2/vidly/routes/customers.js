const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Joi = require("joi");
const Customer = require("../models/customer");

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

router.param("id", (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(404).send("Customer not found");
  }

  next();
});

router.get("/", async (req, res) => {
  const customers = await Customer.find();
  res.send(customers);
});

router.get("/:id", async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).send("Customer not found");

  res.send(customer);
});

router.post("/", validateCustomer, async (req, res) => {
  const customer = await Customer.create({
    name: req.body.name,
    phone: req.body.phone,
    isGold: req.body.isGold,
  });
  res.status(201).send(customer);
});

router.put("/:id", validateCustomer, async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        name: req.body.name,
        isGold: req.body.isGold,
        phone: req.body.phone,
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (!customer) return res.status(404).send("Customer not found");

  res.send(customer);
});

router.delete("/:id", async (req, res) => {
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) return res.status(404).send("Customer not found");

  const customers = await Customer.find();
  res.send(customers);
});

module.exports = router;
