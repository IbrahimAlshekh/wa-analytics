import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import type { TimelineEntry } from "../lib/types";
import PresencePanel from "./PresencePanel";

const NOW = 1700000000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

// A 10-minute closed session; enough to make hasPresence=true
const presenceEntries: TimelineEntry[] = [
  { kind: "presence", at: NOW - 600, state: "available" },
  { kind: "presence", at: NOW, state: "unavailable" },
];

describe("PresencePanel", () => {
  it("renders null when no presence data", () => {
    const { container } = renderWithProviders(
      <PresencePanel entries={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the section title when presence data exists", () => {
    renderWithProviders(<PresencePanel entries={presenceEntries} />);
    expect(screen.getByText("presence.sectionTitle")).toBeInTheDocument();
  });

  it("renders avg session stat card label", () => {
    renderWithProviders(<PresencePanel entries={presenceEntries} />);
    expect(screen.getByText("presence.avgSession")).toBeInTheDocument();
  });

  it("renders longest session stat card label", () => {
    renderWithProviders(<PresencePanel entries={presenceEntries} />);
    expect(screen.getByText("presence.longestSession")).toBeInTheDocument();
  });

  it("shows formatted duration value for the session", () => {
    renderWithProviders(<PresencePanel entries={presenceEntries} />);
    // 600s = 10m in both avg and longest session
    const items = screen.getAllByText("10m");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
