import { describe, it, expect } from "vitest";
import { getVolColor, getRangePos, getSignal } from "../calculations";
import { C } from "../../constants/tokens";

describe("calculations", () => {
  describe("getVolColor", () => {
    it("returns up color for rvol >= 1.5", () => {
      expect(getVolColor(1.5)).toBe(C.up);
      expect(getVolColor(2.0)).toBe(C.up);
    });
    it("returns dn color for rvol < 0.5", () => {
      expect(getVolColor(0.4)).toBe(C.dn);
    });
    it("returns label color otherwise", () => {
      expect(getVolColor(1.0)).toBe(C.label);
    });
  });

  describe("getRangePos", () => {
    it("calculates percentage position correctly", () => {
      expect(getRangePos(150, 100, 200)).toBe(50);
      expect(getRangePos(100, 100, 200)).toBe(0);
      expect(getRangePos(200, 100, 200)).toBe(100);
    });
    it("returns 50 if range is 0", () => {
      expect(getRangePos(100, 100, 100)).toBe(50);
    });
  });

  describe("getSignal", () => {
    it("detects OVERSOLD", () => {
      expect(getSignal({ change_pct: -6 })).toEqual({ label: "OVERSOLD", color: C.dn });
    });
    it("detects UNUSUAL VOL", () => {
      expect(getSignal({ rvol: 2.1 })).toEqual({ label: "UNUSUAL VOL", color: C.accent });
    });
    it("detects BREAKOUT", () => {
      expect(getSignal({ change_pct: 4, volume: 6_000_000 })).toEqual({ label: "BREAKOUT", color: C.accent });
    });
    it("returns null if no signal", () => {
      expect(getSignal({ change_pct: 0, rvol: 1 })).toBe(null);
    });
  });
});
