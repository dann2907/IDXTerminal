import { describe, it, expect } from "vitest";
import { fmt, fmtV, fmtRp, fmtPct, parseNum } from "../formatters";

describe("formatters", () => {
  describe("fmt", () => {
    it("formats large numbers with Indonesian locale", () => {
      expect(fmt(1234)).toBe("1.234");
      expect(fmt(1000000)).toBe("1.000.000");
    });
    it("returns string for small numbers", () => {
      expect(fmt(123)).toBe("123");
    });
  });

  describe("fmtV", () => {
    it("formats millions as M", () => {
      expect(fmtV(1_500_000_000)).toBe("1.5M");
    });
    it("formats hundreds of thousands as Jt", () => {
      expect(fmtV(1_500_000)).toBe("1.5Jt");
    });
    it("formats thousands as Rb", () => {
      expect(fmtV(1500)).toBe("2Rb"); // toFixed(0) on 1.5 is 2? No, 1.5.toFixed(0) is 2 in JS. Wait.
      // 1500 / 1000 = 1.5. 1.5.toFixed(0) = 2.
    });
    it("returns string for small values", () => {
      expect(fmtV(123)).toBe("123");
    });
  });

  describe("fmtRp", () => {
    it("formats trillions as T", () => {
      expect(fmtRp(1_500_000_000_000)).toBe("1.5T");
    });
    it("formats billions as M", () => {
      expect(fmtRp(1_500_000_000)).toBe("1.5M");
    });
    it("returns dash for undefined or 0", () => {
      expect(fmtRp(undefined)).toBe("—");
      expect(fmtRp(0)).toBe("—");
    });
  });

  describe("fmtPct", () => {
    it("adds plus sign for positive numbers", () => {
      expect(fmtPct(1.234)).toBe("+1.23%");
    });
    it("keeps minus sign for negative numbers", () => {
      expect(fmtPct(-1.234)).toBe("-1.23%");
    });
  });

  describe("parseNum", () => {
    it("parses strings with commas as decimals", () => {
      expect(parseNum("1,23")).toBe(1.23);
    });
    it("returns null for empty or invalid strings", () => {
      expect(parseNum("")).toBe(null);
      expect(parseNum("abc")).toBe(null);
    });
  });
});
