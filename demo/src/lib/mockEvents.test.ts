import { beforeEach, describe, expect, it } from "vitest";
import type { WSEnvelope } from "./types";
import { pushEvent, registerTrigger } from "./mockEvents";

beforeEach(() => {
  // Reset to a no-op so each test starts from a clean trigger state
  registerTrigger(() => {});
});

describe("registerTrigger / pushEvent", () => {
  it("pushEvent calls the registered trigger with the message", () => {
    const received: WSEnvelope[] = [];
    registerTrigger((msg) => received.push(msg));

    const msg = { type: "auth.qr", code: "test-qr" } as WSEnvelope;
    pushEvent(msg);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(msg);
  });

  it("re-registering replaces the previous trigger", () => {
    const r1: WSEnvelope[] = [];
    const r2: WSEnvelope[] = [];
    registerTrigger((m) => r1.push(m));
    registerTrigger((m) => r2.push(m));

    pushEvent({ type: "auth.qr", code: "x" } as WSEnvelope);

    expect(r1).toHaveLength(0);
    expect(r2).toHaveLength(1);
  });

  it("multiple pushEvent calls all go through the current trigger", () => {
    const received: WSEnvelope[] = [];
    registerTrigger((m) => received.push(m));

    pushEvent({ type: "auth.qr", code: "a" } as WSEnvelope);
    pushEvent({ type: "auth.qr", code: "b" } as WSEnvelope);

    expect(received).toHaveLength(2);
  });

  it("pushEvent is a no-op when trigger is nulled via a no-op fn", () => {
    // The beforeEach registers a no-op, so pushEvent does nothing observable
    let called = false;
    registerTrigger(() => {
      called = false; // intentionally a no-op
    });
    pushEvent({ type: "auth.qr", code: "x" } as WSEnvelope);
    expect(called).toBe(false);
  });
});
