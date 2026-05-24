import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import type { TimelineEntry } from "@/types/timeline";
import RecentMessages from "./timeline/RecentMessages";

const NOW = 1700000000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

describe("RecentMessages", () => {
  it("shows no-messages for empty entries", () => {
    renderWithProviders(<RecentMessages entries={[]} contactName="Alice" />);
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("shows no-messages when entries contain only presence events", () => {
    const entries: TimelineEntry[] = [
      { kind: "presence", at: NOW - 600, state: "available" },
      { kind: "presence", at: NOW - 60, state: "unavailable" },
    ];
    renderWithProviders(
      <RecentMessages entries={entries} contactName="Alice" />,
    );
    expect(screen.getByText("timeline.noMessages")).toBeInTheDocument();
  });

  it("renders message text", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hello there", isFromMe: false },
    ];
    renderWithProviders(
      <RecentMessages entries={entries} contactName="Alice" />,
    );
    expect(screen.getByText(/hello there/)).toBeInTheDocument();
  });

  it("labels message from contact with contact name", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "hey", isFromMe: false },
    ];
    renderWithProviders(
      <RecentMessages entries={entries} contactName="Bob" />,
    );
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("labels message from self with you translation key", () => {
    const entries: TimelineEntry[] = [
      { kind: "message", at: NOW - 100, text: "sent by me", isFromMe: true },
    ];
    renderWithProviders(
      <RecentMessages entries={entries} contactName="Bob" />,
    );
    expect(screen.getByText(/analytics\.you/)).toBeInTheDocument();
  });
});
