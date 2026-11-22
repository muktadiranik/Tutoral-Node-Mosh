import { afterEach, expect, describe, it, jest } from "@jest/globals";
import * as library from "../library.js";
import database from "../database.js";
import mail from "../mail.js";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("apply discount", () => {
  it("should apply 10% discount if customer has more than 5 points", () => {
    jest.spyOn(database, "getCustomerSync").mockReturnValue({
      id: 1,
      points: 10,
    });
    const order = {
      customerId: 1,
      totalPrice: 10,
    };
    library.applyDiscount(order);
    expect(order.totalPrice).toBe(9);
  });

  it("should not apply a discount if customer has exactly 5 points", () => {
    jest.spyOn(database, "getCustomerSync").mockReturnValue({
      id: 1,
      points: 5,
    });
    const order = {
      customerId: 1,
      totalPrice: 10,
    };

    library.applyDiscount(order);

    expect(order.totalPrice).toBe(10);
  });

  it("should apply 10% discount if customer has more than 5 points", () => {
    database.getCustomerSync = function (customerId) {
      console.log("fake reading customer");
      return { id: customerId, points: 20 };
    };

    const order = {
      customerd: 1,
      totalPrice: 10,
    };
    library.applyDiscount(order);
  });
});

describe("notify customer", () => {
  it("should send an order confirmation email", () => {
    jest.spyOn(database, "getCustomerSync").mockReturnValue({
      id: 1,
      email: "customer@example.com",
    });
    const sendMailMock = jest
      .spyOn(mail, "sendMail")
      .mockImplementation(() => {});
    const order = {
      customerId: 1,
      totalPrice: 10,
    };

    library.notifyCustomer(order);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      "customer@example.com",
      "Your order has been confirmed.",
    );
  });

  describe("notify customer", () => {
    it("should send an order confirmation email", () => {
      database.getCustomerSync = function (customerId) {
        return { email: "customer@example.com" };
      };

      let mailSent = false;
      mail.sendMail = function (email, message) {
        console.log(`Sending email to ${email}: ${message}`);
        mailSent = true;
      };

      library.notifyCustomer({ customerId: 1 });

      expect(mailSent).toBe(true);
    });
  });

  describe("notify customer", () => {
    it("should send an order confirmation email", () => {
      const mockFunction = jest.fn();
      mockFunction.mockReturnValue(1);
      const result = mockFunction();

      database.getCustomerSync = function (customerId) {
        return { email: "customer@example.com" };
      };

      let mailSent = false;
      mail.sendMail = function (email, message) {
        console.log(`Sending email to ${email}: ${message}`);
        mailSent = true;
      };

      library.notifyCustomer({ customerId: 1 });

      expect(mailSent).toBe(true);
    });

    it("should send an order confirmation email", () => {
      const mockFunction = jest.fn();
      mockFunction.mockResolvedValue(new Error("Error"));
      const result = mockFunction();

      database.getCustomerSync = function (customerId) {
        return { email: "customer@example.com" };
      };

      let mailSent = false;
      mail.sendMail = function (email, message) {
        console.log(`Sending email to ${email}: ${message}`);
        mailSent = true;
      };

      library.notifyCustomer({ customerId: 1 });

      expect(mailSent).toBe(true);
    });

    it("should send an order confirmation email using jest mock function", () => {
      database.getCustomerSync = jest
        .fn()
        .mockReturnValue({ email: "customer@example.com" });
      mail.sendMail = jest.fn();

      library.notifyCustomer({ customerId: 1 });

      expect(mail.sendMail).toHaveBeenCalled();

      expect(mail.sendMail).toHaveBeenCalledWith(
        "customer@example.com",
        "Your order has been confirmed.",
      );

      expect(mail.sendMail).toHaveBeenNthCalledWith(
        1,
        "customer@example.com",
        "Your order has been confirmed.",
      );

      expect(mail.sendMail.mock.calls[0][0]).toBe("customer@example.com");
      expect(mail.sendMail.mock.calls[0][1]).toMatch(
        /Your order has been confirmed/,
      );
    });
  });
});
