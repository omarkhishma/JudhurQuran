import { describe, expect, it } from "vitest";
import { readNumber } from "./format";

describe("readNumber", () => {
  it("reads a number in any of the reader's digits", () => {
    expect(readNumber("٧")).toBe(7);
    expect(readNumber("١٢٫٥")).toBe(12.5);
    expect(readNumber("۱۲۳")).toBe(123);
    expect(readNumber("1,250")).toBe(1250);
    expect(readNumber("−3")).toBe(-3);
    expect(readNumber(" 42 ")).toBe(42);
    expect(readNumber("سبعة")).toBeNaN();
    expect(readNumber("")).toBeNaN();
  });
});
