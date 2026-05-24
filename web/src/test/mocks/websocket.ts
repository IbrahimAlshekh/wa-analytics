import type { WSEnvelope } from "@/types/ws";

type ReadyState = 0 | 1 | 2 | 3;

class MockWebSocketInstance {
  static readonly CONNECTING = 0 as const;
  static readonly OPEN = 1 as const;
  static readonly CLOSING = 2 as const;
  static readonly CLOSED = 3 as const;

  readyState: ReadyState = 0;
  url: string;
  sent: string[] = [];

  onopen: ((evt: Event) => void) | null = null;
  onmessage: ((evt: MessageEvent) => void) | null = null;
  onclose: ((evt: CloseEvent) => void) | null = null;
  onerror: ((evt: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocketInstance._instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
  }

  // Test helpers — call these from tests to drive WS behaviour.
  triggerOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  triggerMessage(msg: WSEnvelope) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(msg) }),
    );
  }

  triggerClose(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
  }

  triggerError() {
    this.onerror?.(new Event("error"));
  }

  static _instances: MockWebSocketInstance[] = [];
  static latest(): MockWebSocketInstance {
    const inst = MockWebSocketInstance._instances.at(-1);
    if (!inst) throw new Error("No MockWebSocket instances created yet");
    return inst;
  }
  static reset() {
    MockWebSocketInstance._instances = [];
  }
}

const _OriginalWebSocket = globalThis.WebSocket;

export function installMockWebSocket() {
  MockWebSocketInstance.reset();
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: MockWebSocketInstance,
  });
  return {
    latest: () => MockWebSocketInstance.latest(),
    instances: () => MockWebSocketInstance._instances,
    restore: () => {
      Object.defineProperty(globalThis, "WebSocket", {
        configurable: true,
        writable: true,
        value: _OriginalWebSocket,
      });
      MockWebSocketInstance.reset();
    },
  };
}
