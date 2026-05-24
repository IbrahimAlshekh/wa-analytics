import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WSEnvelope } from "./types";
import { installMockWebSocket } from "../test/mocks/websocket";

// Import ws lazily so we can control module reset
async function importWs() {
  vi.resetModules();
  return import("./ws");
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllTimers();
  localStorage.clear();
});

describe("WSHub — start", () => {
  it("opens a WebSocket connection on start()", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "test-token");
    ws.start();

    expect(latest().url).toMatch(/\/api\/ws/);
    restore();
  });

  it("sends auth token on open when token is set", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "my-jwt");
    ws.start();
    latest().triggerOpen();

    expect(latest().sent.length).toBe(1);
    expect(JSON.parse(latest().sent[0])).toEqual({ token: "my-jwt" });
    restore();
  });

  it("closes immediately when no token is set", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    ws.start();
    latest().triggerOpen();

    expect(latest().readyState).toBe(3); // CLOSED
    restore();
  });

  it("does not create a second socket if already connected", async () => {
    const { instances, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();
    instances()[0].readyState = 1; // OPEN
    ws.start(); // second call — should be ignored

    expect(instances().length).toBe(1);
    restore();
  });
});

describe("WSHub — message handling", () => {
  it("dispatches parsed WS message to listeners", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();

    const received: unknown[] = [];
    ws.on((msg) => received.push(msg));

    latest().triggerOpen();
    latest().triggerMessage({ type: "auth.qr", code: "qr123" } as WSEnvelope);

    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe("auth.qr");
    restore();
  });

  it("fanout to multiple listeners", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();

    const r1: unknown[] = [];
    const r2: unknown[] = [];
    ws.on((m) => r1.push(m));
    ws.on((m) => r2.push(m));
    latest().triggerOpen();
    latest().triggerMessage({ type: "auth.qr", code: "x" } as WSEnvelope);

    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    restore();
  });

  it("unsubscribe stops delivering messages", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();
    latest().triggerOpen();

    const received: unknown[] = [];
    const off = ws.on((m) => received.push(m));
    off(); // unsubscribe immediately
    latest().triggerMessage({ type: "auth.qr", code: "x" } as WSEnvelope);

    expect(received).toHaveLength(0);
    restore();
  });
});

describe("WSHub — close / reconnect", () => {
  it("clears token on close code 4001", async () => {
    const { latest, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();
    latest().triggerOpen();
    latest().triggerClose(4001, "auth failed");

    expect(localStorage.getItem("wt_bearer")).toBeNull();
    restore();
  });

  it("schedules reconnect after non-4001 close", async () => {
    vi.useFakeTimers();
    const { instances, restore } = installMockWebSocket();
    const { ws } = await importWs();

    localStorage.setItem("wt_bearer", "t");
    ws.start();
    instances()[0].triggerOpen();
    instances()[0].triggerClose(1006, "network error");

    expect(instances().length).toBe(1); // not yet reconnected

    vi.advanceTimersByTime(2001);
    expect(instances().length).toBe(2); // reconnected

    restore();
  });
});
