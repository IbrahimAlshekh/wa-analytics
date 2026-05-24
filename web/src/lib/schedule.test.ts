import { describe, expect, it } from "vitest";
import { minutesToTime, timeToMinutes } from "./schedule";

describe("minutesToTime", () => {
  it("formats zero as 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("formats midnight as 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("formats noon as 12:00", () => {
    expect(minutesToTime(720)).toBe("12:00");
  });

  it("pads single digit hours and minutes", () => {
    expect(minutesToTime(65)).toBe("01:05");
  });

  it("formats end of day as 23:59", () => {
    expect(minutesToTime(1439)).toBe("23:59");
  });
});

describe("timeToMinutes", () => {
  it("parses 00:00 as 0", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("parses 12:00 as 720", () => {
    expect(timeToMinutes("12:00")).toBe(720);
  });

  it("parses 23:59 as 1439", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("parses 01:05 as 65", () => {
    expect(timeToMinutes("01:05")).toBe(65);
  });

  it("round-trips with minutesToTime", () => {
    const cases = [0, 65, 720, 1439];
    for (const min of cases) {
      expect(timeToMinutes(minutesToTime(min))).toBe(min);
    }
  });

  it("empty string parses as 0 (Number('') === 0)", () => {
    expect(timeToMinutes("")).toBe(0);
  });

  it("returns NaN for non-numeric input (no error handling by design)", () => {
    expect(Number.isNaN(timeToMinutes("bad"))).toBe(true);
  });
});
