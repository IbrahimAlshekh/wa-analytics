import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import type { TimelineEntry } from "@/types/timeline";
import SessionTimeline from "./timeline/SessionTimeline";

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

const defaultProps = { accountId: 1, contactId: 1 };

describe("SessionTimeline", () => {
  it("shows no-messages for empty entries", () => {
    renderWithProviders(
      <SessionTimeline entries={[]} contactName="Alice" {...defaultProps} />,
    );
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("shows no-messages when entries contain only presence events", () => {
    const entries = [p(-600, "available"), p(-60, "unavailable")];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Alice" {...defaultProps} />,
    );
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("renders session blocks section for presence entries", () => {
    const entries = [p(-600, "available"), p(-60, "unavailable")];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Alice" {...defaultProps} />,
    );
    expect(screen.getByText("timeline.statusSection")).toBeInTheDocument();
  });

  it("shows no-messages when only presence entries are present", () => {
    const entries = [p(-600, "available"), p(-60, "unavailable")];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Alice" {...defaultProps} />,
    );
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("renders message text in recent messages section", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hello there", isFromMe: false },
    ];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Alice" {...defaultProps} />,
    );
    expect(screen.getByText(/hello there/)).toBeInTheDocument();
  });

  it("labels message from contact with contact name", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hey", isFromMe: false },
    ];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Bob" {...defaultProps} />,
    );
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("labels message from self with you translation key", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "sent by me", isFromMe: true },
    ];
    renderWithProviders(
      <SessionTimeline entries={entries} contactName="Bob" {...defaultProps} />,
    );
    // In cimode, t("analytics.you") returns "analytics.you"
    expect(screen.getByText(/analytics\.you/)).toBeInTheDocument();
  });
});
