import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBlocks, formatDuration, MERGE_GAP_SEC } from "./sessions";
import type { TimelineEntry } from "./types";

// Fixed "now" so buildBlocks's offline-indicator logic is deterministic.
const NOW = 1700000000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

// Presence entry relative to NOW (negative = in the past)
const p = (offset: number, state: "available" | "unavailable"): TimelineEntry => ({
  kind: "presence",
  at: NOW + offset,
  state,
});

describe("buildBlocks — basic session pairing", () => {
  it("returns [] for empty entries", () => {
    expect(buildBlocks([])).toEqual([]);
  });

  it("pairs a single available→unavailable into one session block", () => {
    // Last offline is NOW-5s → offlineSince = 5 ≤ 30 → no offline indicator prepended
    const blocks = buildBlocks([p(-600, "available"), p(-5, "unavailable")]);
    expect(blocks.length).toBe(1);
    const b = blocks[0];
    expect(b.type).toBe("session");
    if (b.type === "session") {
      expect(b.session.startAt).toBe(NOW - 600);
      expect(b.session.endAt).toBe(NOW - 5);
      expect(b.session.durationSec).toBe(595);
    }
  });

  it("open session (currently online) has endAt null", () => {
    const blocks = buildBlocks([p(-600, "available")]);
    expect(blocks.length).toBe(1);
    const b = blocks[0];
    expect(b.type).toBe("session");
    if (b.type === "session") {
      expect(b.session.endAt).toBeNull();
      expect(b.session.durationSec).toBeNull();
    }
  });

  it("prepends offline-gap indicator when last offline > 30s ago", () => {
    // Last offline is NOW-60s → offlineSince = 60 > 30 → indicator prepended
    const blocks = buildBlocks([p(-600, "available"), p(-60, "unavailable")]);
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("offline-gap");
    expect(blocks[1].type).toBe("session");
  });

  it("ignores standalone unavailable before any available", () => {
    const blocks = buildBlocks([p(-900, "unavailable"), p(-600, "available"), p(-5, "unavailable")]);
    const sessions = blocks.filter((b) => b.type === "session");
    expect(sessions.length).toBe(1);
  });
});

describe("buildBlocks — merge gap", () => {
  it(`merges two sessions separated by <= ${MERGE_GAP_SEC}s`, () => {
    // gap between them = 100s < MERGE_GAP_SEC → merge into one
    const blocks = buildBlocks([
      p(-600, "available"),
      p(-540, "unavailable"), // 60s session
      p(-440, "available"),   // gap = 100s
      p(-300, "unavailable"),
    ]);
    const sessions = blocks.filter((b) => b.type === "session");
    expect(sessions.length).toBe(1);
    const s = sessions[0];
    if (s.type === "session") {
      expect(s.session.startAt).toBe(NOW - 600);
      expect(s.session.endAt).toBe(NOW - 300);
    }
  });

  it("does NOT merge sessions separated by > merge gap", () => {
    const blocks = buildBlocks([
      p(-1000, "available"),
      p(-940, "unavailable"),
      p(-600, "available"),   // gap = 340s > MERGE_GAP_SEC
      p(-5, "unavailable"),
    ]);
    const sessions = blocks.filter((b) => b.type === "session");
    expect(sessions.length).toBe(2);
  });
});

describe("buildBlocks — interleaved events", () => {
  it("inserts picture events between sessions", () => {
    const entries: TimelineEntry[] = [
      p(-1000, "available"),
      p(-700, "unavailable"),
      { kind: "picture", at: NOW - 850 },
      p(-300, "available"),
      p(-5, "unavailable"),
    ];
    const blocks = buildBlocks(entries);
    const types = blocks.map((b) => b.type);
    expect(types).toContain("session");
    expect(types).toContain("event");
  });

  it("output is sorted newest-first", () => {
    const entries: TimelineEntry[] = [
      p(-1000, "available"),
      p(-700, "unavailable"),
      p(-300, "available"),
      p(-5, "unavailable"),
    ];
    const blocks = buildBlocks(entries);
    const sessions = blocks
      .filter((b) => b.type === "session")
      .map((b) => (b.type === "session" ? b.session.startAt : 0));
    expect(sessions[0]).toBeGreaterThan(sessions[sessions.length - 1]);
  });
});

describe("buildBlocks — consecutive available events", () => {
  it("does not extend session start on duplicate available", () => {
    const blocks = buildBlocks([
      p(-600, "available"),
      p(-590, "available"), // noise — session start must stay at -600
      p(-5, "unavailable"),
    ]);
    const sessions = blocks.filter((b) => b.type === "session");
    expect(sessions.length).toBe(1);
    if (sessions[0].type === "session") {
      expect(sessions[0].session.startAt).toBe(NOW - 600);
    }
  });
});

describe("formatDuration (sessions)", () => {
  it("formats < 60s as Xs", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(120)).toBe("2m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7200)).toBe("2h 0m");
  });

  it("formats days", () => {
    expect(formatDuration(86400)).toBe("1d 0h");
    expect(formatDuration(90000)).toBe("1d 1h");
  });
});
