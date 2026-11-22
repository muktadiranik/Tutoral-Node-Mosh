import { expect, describe, it } from "@jest/globals";
import * as excercise from "../exercise";

describe("fizzBuzz", () => {
  it("should throw an error if the input is not a number", () => {
    expect(() => excercise.fizzBuzz("a")).toThrow("Input must be a number");
  });

  it("should throw an error if the input is a negative number", () => {
    expect(() => excercise.fizzBuzz(-1)).toThrow(
      "Input must be a positive number",
    );
  });

  it("should throw an error if the input is a zero", () => {
    expect(() => excercise.fizzBuzz(0)).toThrow(
      "Input must be a positive number",
    );
  });

  it("should not throw an error if the input is a positive number", () => {
    expect(() => excercise.fizzBuzz(1)).not.toThrow();
  });

  it("should return 'Fizz' if the input is divisible by 3", () => {
    expect(excercise.fizzBuzz(3)).toBe("Fizz");
  });

  it("should return 'Buzz' if the input is divisible by 5", () => {
    expect(excercise.fizzBuzz(5)).toBe("Buzz");
  });

  it("should return 'FizzBuzz' if the input is divisible by both 3 and 5", () => {
    expect(excercise.fizzBuzz(15)).toBe("FizzBuzz");
  });

  it("should return the input if it is not divisible by 3 or 5", () => {
    expect(excercise.fizzBuzz(7)).toBe(7);
  });
});
