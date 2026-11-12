const mongoose = require("mongoose");
const Customer = require("./models/customer");
const customers = require("./data/customers");

async function createCustomers() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/mongo-exercises",
    );

    // Keep only customer fields and let MongoDB generate each document's _id.
    const customerArray = customers.map(({ name, isGold, phone }) => ({
      name,
      isGold,
      phone,
    }));
    const result = await Customer.insertMany(customerArray);
    console.log(`Created ${result.length} customers`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  createCustomers().catch((err) => {
    console.error("Could not create customers:", err.message);
    process.exitCode = 1;
  });
}

module.exports = createCustomers;
