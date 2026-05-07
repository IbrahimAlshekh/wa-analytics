import type { WSEnvelope } from "./types";

type Listener = (msg: WSEnvelope) => void;

class WSHub {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;

  start() {
    if (this.socket && this.socket.readyState <= 1) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const tokenParam = (() => {
      const t = localStorage.getItem("wt_bearer");
      return t ? `?token=${encodeURIComponent(t)}` : "";
    })();
    const url = `${proto}://${location.host}/api/ws${tokenParam}`;
    const sock = new WebSocket(url);
    this.socket = sock;
    sock.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as WSEnvelope;
        this.listeners.forEach((l) => l(msg));
      } catch (e) {
        console.warn("ws parse error", e);
      }
    };
    sock.onclose = () => {
      this.socket = null;
      if (this.reconnectTimer != null) return;
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.start();
      }, 2000);
    };
    sock.onerror = () => {
      sock.close();
    };
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const ws = new WSHub();
