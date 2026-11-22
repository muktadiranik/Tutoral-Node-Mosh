import database from "./database.js";
import mail from "./mail.js";

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  return a / b;
}

function absolute(number) {
  if (number > 0) return number;
  if (number < 0) return -number;
  return 0;
}

function square(number) {
  return number ? number * number : 0;
}

function greet(name) {
  return `Hello, ${name}!`;
}

function array(array) {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
}

function object() {
  return {
    name: "John",
    age: 30,
    city: "New York",
    profession: "Musician",
  };
}

function exception(name) {
  if (!name) throw new Error("Name is required");
  return name;
}

function noException(name) {
  return "No exception";
}

function divideByNoDivider(number, divider) {
  if (number === 0) throw new Error("Cannot divide by zero");
  return number / divider;
}

function currentTime() {
  return new Date().getTime();
}

function applyDiscount(order) {
  const customer = database.getCustomerSync(order.customerId);

  if (customer.points > 5) {
    order.totalPrice *= 0.9;
  }
}

function notifyCustomer(order) {
  console.log(`notifying customer ${order.customerId}`);

  const customer = database.getCustomerSync(order.customerId);
  mail.sendMail(customer.email, "Your order has been confirmed.");
}

export {
  add,
  subtract,
  multiply,
  divide,
  absolute,
  square,
  greet,
  array,
  object,
  exception,
  divideByNoDivider,
  noException,
  currentTime,
  applyDiscount,
  notifyCustomer,
};
