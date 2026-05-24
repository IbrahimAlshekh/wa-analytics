import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "./types";
import {
  parseSessions,
  computeAvgSessionDuration,
  computeLongestSession,
  computeFirstLastSeen,
  computePicChangeFrequency,
  computeConsistencyScore,
  computeNightOwlScore,
  computeOnlinePatternSummary,
  formatDuration,
} from "./presence-stats";

// DSL helpers
const p = (at: number, state: "available" | "unavailable"): TimelineEntry => ({
  kind: "presence",
  at,
  state,
});
const pic = (at: number): TimelineEntry => ({ kind: "picture", at });

describe("parseSessions", () => {
  it("returns empty durations for no entries", () => {
    expect(parseSessions([])).toEqual({ durations: [] });
  });

  it("returns empty durations for single available (no close)", () => {
    expect(parseSessions([p(1000, "available")])).toEqual({ durations: [] });
  });

  it("captures paired sessions", () => {
    const { durations } = parseSessions([
      p(1000, "available"),
      p(1600, "unavailable"),
      p(2000, "available"),
      p(2300, "unavailable"),
    ]);
    expect(durations).toEqual([600, 300]);
  });

  it("ignores standalone unavailable before any available", () => {
    const { durations } = parseSessions([
      p(500, "unavailable"),
      p(1000, "available"),
      p(1600, "unavailable"),
    ]);
    expect(durations).toEqual([600]);
  });
});

describe("computeAvgSessionDuration", () => {
  it("returns null with no sessions", () => {
    expect(computeAvgSessionDuration([])).toBeNull();
  });

  it("averages session durations", () => {
    const entries = [
      p(0, "available"),
      p(600, "unavailable"),
      p(1000, "available"),
      p(1400, "unavailable"), // 400s
    ];
    // avg = (600 + 400) / 2 = 500
    expect(computeAvgSessionDuration(entries)).toBe(500);
  });
});

describe("computeLongestSession", () => {
  it("returns null with no sessions", () => {
    expect(computeLongestSession([])).toBeNull();
  });

  it("returns the longest session", () => {
    const entries = [
      p(0, "available"),
      p(300, "unavailable"),
      p(1000, "available"),
      p(2000, "unavailable"), // 1000s
    ];
    expect(computeLongestSession(entries)).toBe(1000);
  });
});

describe("computeFirstLastSeen", () => {
  it("returns nulls for empty entries", () => {
    expect(computeFirstLastSeen([])).toEqual({ firstSeen: null, lastSeen: null });
  });

  it("returns correct first and last presence timestamps", () => {
    const entries = [p(1000, "available"), p(2000, "unavailable"), p(3000, "available")];
    expect(computeFirstLastSeen(entries)).toEqual({ firstSeen: 1000, lastSeen: 3000 });
  });
});

describe("computePicChangeFrequency", () => {
  it("returns null with < 2 picture entries", () => {
    expect(computePicChangeFrequency([])).toBeNull();
    expect(computePicChangeFrequency([pic(1000)])).toBeNull();
  });

  it("calculates average days between picture changes", () => {
    // 3 pics spanning 10 days → every 5 days on average
    const entries = [pic(0), pic(86400 * 5), pic(86400 * 10)];
    expect(computePicChangeFrequency(entries)).toBe(5);
  });
});

describe("computeConsistencyScore", () => {
  it("returns null with < 3 days of data", () => {
    const entries = [p(0, "available"), p(3600, "unavailable")];
    expect(computeConsistencyScore(entries)).toBeNull();
  });

  it("returns high score (near 100) for perfectly consistent days", () => {
    // Same 1-hour session each of 7 days
    const DAY = 86400;
    const entries: TimelineEntry[] = [];
    for (let i = 0; i < 7; i++) {
      entries.push(p(i * DAY, "available"), p(i * DAY + 3600, "unavailable"));
    }
    const score = computeConsistencyScore(entries);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(90);
  });
});

describe("computeNightOwlScore", () => {
  it("returns null with no presence entries", () => {
    expect(computeNightOwlScore([])).toBeNull();
  });

  it("returns 100 for sessions entirely in midnight–5am", () => {
    // 2024-01-01 00:00–04:00 UTC (ensure test is in UTC by using explicit timestamp)
    // Midnight UTC 2024-01-01 = 1704067200
    const midnight = 1704067200;
    const entries = [
      p(midnight, "available"),
      p(midnight + 4 * 3600, "unavailable"), // 04:00 UTC
    ];
    const score = computeNightOwlScore(entries);
    expect(score).toBe(100);
  });
});

describe("computeOnlinePatternSummary", () => {
  it("returns null when all values are zero", () => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      hour: i.toString().padStart(2, "0"),
      minutes: 0,
    }));
    expect(computeOnlinePatternSummary(data)).toBeNull();
  });

  it("returns pattern string for concentrated activity", () => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      hour: i.toString().padStart(2, "0"),
      minutes: i >= 9 && i <= 11 ? 60 : 0,
    }));
    const result = computeOnlinePatternSummary(data);
    expect(result).not.toBeNull();
    expect(result).toMatch(/9am/);
    expect(result).toMatch(/11am/);
  });
});

describe("formatDuration (presence-stats)", () => {
  it("formats seconds", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  it("formats minutes", () => {
    expect(formatDuration(90)).toBe("2m");
    expect(formatDuration(3599)).toBe("60m");
  });

  it("formats hours with and without minutes", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3660)).toBe("1h 1m");
  });
});
