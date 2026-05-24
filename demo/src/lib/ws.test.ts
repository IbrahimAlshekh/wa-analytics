import { afterEach, describe, expect, it, vi } from "vitest";
import type { WSEnvelope } from "./types";

// vi.resetModules() gives each test a fresh MockWSHub instance (started=false)
// so tests remain independent from each other.
async function importModules() {
  vi.resetModules();
  const wsMod = await import("./ws");
  // Import mockEvents AFTER ws so we get the same cached module instance
  // that ws.ts registered its trigger against.
  const eventsMod = await import("./mockEvents");
  return { ws: wsMod.ws, pushEvent: eventsMod.pushEvent };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllTimers();
});

describe("MockWSHub — start", () => {
  it("start() registers a trigger and delivers messages to on() listeners", async () => {
    const { ws, pushEvent } = await importModules();

    const received: WSEnvelope[] = [];
    ws.on((m) => received.push(m));
    ws.start();

    pushEvent({ type: "auth.qr", code: "hello" } as WSEnvelope);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "auth.qr", code: "hello" });
  });

  it("start() is idempotent — calling twice does not double-register", async () => {
    const { ws, pushEvent } = await importModules();

    const received: WSEnvelope[] = [];
    ws.on((m) => received.push(m));
    ws.start();
    ws.start(); // second call must be no-op

    pushEvent({ type: "auth.qr", code: "x" } as WSEnvelope);

    expect(received).toHaveLength(1);
  });
});

describe("MockWSHub — listeners", () => {
  it("on() unsubscribe stops delivery", async () => {
    const { ws, pushEvent } = await importModules();

    ws.start();
    const received: WSEnvelope[] = [];
    const off = ws.on((m) => received.push(m));
    off();

    pushEvent({ type: "auth.qr", code: "x" } as WSEnvelope);

    expect(received).toHaveLength(0);
  });

  it("multiple listeners all receive the same message", async () => {
    const { ws, pushEvent } = await importModules();

    ws.start();
    const r1: WSEnvelope[] = [];
    const r2: WSEnvelope[] = [];
    ws.on((m) => r1.push(m));
    ws.on((m) => r2.push(m));

    pushEvent({ type: "auth.qr", code: "y" } as WSEnvelope);

    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });
});

describe("MockWSHub — scripted events via fake timers", () => {
  it("fires a presence event after 8 seconds", async () => {
    vi.useFakeTimers();
    const { ws } = await importModules();

    const received: WSEnvelope[] = [];
    ws.on((m) => received.push(m));
    ws.start();

    expect(received).toHaveLength(0);
    vi.advanceTimersByTime(8_001);

    const presences = received.filter((m) => m.type === "presence");
    expect(presences.length).toBeGreaterThanOrEqual(1);
  });

  it("fires a message event after 35 seconds", async () => {
    vi.useFakeTimers();
    const { ws } = await importModules();

    const received: WSEnvelope[] = [];
    ws.on((m) => received.push(m));
    ws.start();

    vi.advanceTimersByTime(35_001);

    const messages = received.filter((m) => m.type === "message");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });
});
