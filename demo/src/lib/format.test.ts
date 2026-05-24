import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelative, formatDuration, formatCount, getInitials } from "./format";

const NOW_UNIX = 1700000000; // fixed reference point

describe("formatRelative", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_UNIX * 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("returns seconds for < 60s ago", () => {
    expect(formatRelative(NOW_UNIX - 30)).toBe("30s ago");
  });

  it("returns 0s ago for future timestamps", () => {
    expect(formatRelative(NOW_UNIX + 100)).toBe("0s ago");
  });

  it("returns minutes for < 1h ago", () => {
    expect(formatRelative(NOW_UNIX - 90)).toBe("1m ago");
    expect(formatRelative(NOW_UNIX - 3599)).toBe("59m ago");
  });

  it("returns hours for < 24h ago", () => {
    expect(formatRelative(NOW_UNIX - 3600)).toBe("1h ago");
    expect(formatRelative(NOW_UNIX - 86399)).toBe("23h ago");
  });

  it("returns days for >= 24h ago", () => {
    expect(formatRelative(NOW_UNIX - 86400)).toBe("1d ago");
    expect(formatRelative(NOW_UNIX - 86400 * 7)).toBe("7d ago");
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats minutes (rounds)", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(90)).toBe("2m");
    expect(formatDuration(3599)).toBe("60m");
  });

  it("formats hours with minutes", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(7260)).toBe("2h 1m");
  });
});

describe("formatCount", () => {
  it("returns plain number for < 1000", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("returns k suffix for >= 1000", () => {
    expect(formatCount(1000)).toBe("1.0k");
    expect(formatCount(1500)).toBe("1.5k");
    expect(formatCount(999999)).toBe("1000.0k");
  });

  it("returns M suffix for >= 1_000_000", () => {
    expect(formatCount(1_000_000)).toBe("1.0M");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
});

describe("getInitials", () => {
  it("returns last two digits for phone numbers", () => {
    expect(getInitials("+4917600001")).toBe("49");
  });

  it("returns first letters of first two words", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("sara müller")).toBe("SM");
  });

  it("returns first two chars for single word", () => {
    expect(getInitials("Alice")).toBe("AL");
  });

  it("handles extra whitespace", () => {
    expect(getInitials("  John  Doe  ")).toBe("JD");
  });
});
