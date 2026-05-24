import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import type { TimelineEntry } from "../lib/types";
import SessionTimeline from "./Timeline";

const NOW = 1700000000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const p = (
  offset: number,
  state: "available" | "unavailable",
): TimelineEntry => ({ kind: "presence", at: NOW + offset, state });

describe("SessionTimeline", () => {
  it("shows no-events message for empty entries", () => {
    renderWithProviders(<SessionTimeline entries={[]} contactName="Alice" />);
    expect(screen.getByText("timeline.noEvents")).toBeInTheDocument();
  });

  it("shows no-sessions when entries contain only messages", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 60, text: "hi", isFromMe: false },
    ];
    renderWithProviders(<SessionTimeline entries={entries} contactName="Alice" />);
    expect(screen.getByText("timeline.noSessions")).toBeInTheDocument();
  });

  it("renders session block for a completed presence pair", () => {
    const entries = [p(-600, "available"), p(-60, "unavailable")];
    renderWithProviders(<SessionTimeline entries={entries} contactName="Alice" />);
    expect(screen.queryByText("timeline.noSessions")).not.toBeInTheDocument();
  });

  it("shows no-messages when only presence entries are present", () => {
    const entries = [p(-600, "available"), p(-60, "unavailable")];
    renderWithProviders(<SessionTimeline entries={entries} contactName="Alice" />);
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("renders message text in recent messages section", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hello there", isFromMe: false },
    ];
    renderWithProviders(<SessionTimeline entries={entries} contactName="Alice" />);
    expect(screen.getByText(/hello there/)).toBeInTheDocument();
  });

  it("labels message from contact with contact name", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hey", isFromMe: false },
    ];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Bob" />,
    );
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("labels message from self with you translation key", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "sent by me", isFromMe: true },
    ];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Bob" />,
    );
    // In cimode, t("analytics.you") returns "analytics.you"
    expect(screen.getByText(/analytics\.you/)).toBeInTheDocument();
  });
});
