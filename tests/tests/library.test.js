import { test, expect, describe, it } from "@jest/globals";
import * as library from "../library.js";

describe("absolute", () => {
  it("Should return positive number when input is negative", () => {
    const result = library.absolute(-10);
    expect(result).toBe(10);
  });

  it("Should return positive number when input is positive", () => {
    const result = library.absolute(10);
    expect(result).toBe(10);
  });

  it("Should return 0 when input is 0", () => {
    const result = library.absolute(0);
    expect(result).toBe(0);
  });
});

describe("square", () => {
  it("Should return positive number when input is negative", () => {
    const result = library.square(-10);
    expect(result).toBe(100);
  });

  it("Should return positive number when input is positive", () => {
    const result = library.square(10);
    expect(result).toBe(100);
  });

  it("Should return 0 when input is 0", () => {
    const result = library.square(0);
    expect(result).toBe(0);
  });
});

test("add", () => {
  const result = library.add(1, 2);
  expect(result).toBe(3);
});

test("subtract", () => {
  const result = library.subtract(1, 2);
  expect(result).toBe(-1);
});

test("multiply", () => {
  const result = library.multiply(1, 2);
  expect(result).toBe(2);
});

test("divide", () => {
  const result = library.divide(1, 2);
  expect(result).toBe(0.5);
});

describe("greet", () => {
  it("should return a greeting", () => {
    const result = library.greet("John");
    expect(result).toBe("Hello, John!");
  });

  it("should return a greeting", () => {
    const result = library.greet("John");
    expect(result).toMatch(/John/);
    expect(result).toContain("John");
  });
});

describe("array", () => {
  it("should return an array", () => {
    const result = library.array();
    expect(result).toBeInstanceOf(Array);
  });

  it("should return an array consisting the element 5", () => {
    const result = library.array(5);
    expect(result).toContain(5);
  });

  it("should return an array consisting the element 5, 6, and 7", () => {
    const result = library.array(5, 6, 7);
    [5, 6, 7].forEach((element) => {
      expect(result).toContain(element);
    });
  });

  it("should return an array consisting the element 5, 6, and 7 in ideal way", () => {
    const result = library.array(5, 6, 7);
    expect(result).toEqual(expect.arrayContaining([5, 6, 7]));
  });
});

describe("object", () => {
  it("should return an object", () => {
    const result = library.object();
    expect(result).toBeInstanceOf(Object);
  });

  it("should return an object consisting the name of the person", () => {
    const result = library.object("John");
    expect(result).toMatchObject({ name: "John" });
  });

  it("should return an object consisting the name and age of the person", () => {
    const result = library.object("John", 30);
    expect(result).toMatchObject({ name: "John", age: 30 });
  });

  it("should return an object with key, value property matching", () => {
    const result = library.object("John", 30);
    expect(result).toHaveProperty("name", "John");
  });
});

describe("exception", () => {
  it("returns a valid name", () => {
    expect(library.exception("Mosh")).toBe("Mosh");
  });

  it("throws when the name is missing", () => {
    expect(() => library.exception()).toThrow("Name is required");
  });

  it("throws when the name is null", () => {
    expect(() => library.exception(null)).toThrow("Name is required");
  });

  describe("unparameterized test", () => {
    it("throws for every falsy input", () => {
      const args = [null, undefined, NaN, "", 0, false];
      args.forEach((element) => {
        expect(() => library.exception(element)).toThrow("Name is required");
      });
    });
  });

  describe("parameterized test", () => {
    it.each([null, undefined, NaN, "", 0, false])(
      "throws for %p",
      (element) => {
        expect(() => library.exception(element)).toThrow("Name is required");
      },
    );

    it("should return 'No exception'", () => {
      expect(library.noException("Jhon")).toBe("No exception");
    });
  });

  it.each([
    ["true", true],
    ["an empty array", []],
    ["an empty object", {}],
  ])("returns %s because it is truthy", (_description, value) => {
    expect(() => library.exception(value)).not.toThrow();
    expect(library.exception(value)).toBe(value);
  });
});

describe("noException", () => {
  it("returns its message without throwing", () => {
    expect(() => library.noException("John")).not.toThrow();
    expect(library.noException("John")).toBe("No exception");
  });
});

describe("time", () => {
  it("current time is greater than zero", () => {
    expect(library.currentTime()).toBeGreaterThan(0);
  });
});
