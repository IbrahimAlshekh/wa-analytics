import type { WSEnvelope } from "./types";

type Listener = (msg: WSEnvelope) => void;

class WSHub {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;

  start() {
    if (this.socket && this.socket.readyState <= 1) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/api/ws`;
    const sock = new WebSocket(url);
    this.socket = sock;

    sock.onopen = () => {
      // Auth handshake: send token as first message after connection opens.
      const t = localStorage.getItem("wt_bearer");
      if (t) {
        sock.send(JSON.stringify({ token: t }));
      } else {
        // No token — server will close with 4001.
        sock.close();
      }
    };

    sock.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as WSEnvelope;
        this.listeners.forEach((l) => l(msg));
      } catch (e) {
        console.warn("ws parse error", e);
      }
    };

    sock.onclose = (evt) => {
      this.socket = null;
      // Code 4001 = auth failed, don't reconnect.
      if (evt.code === 4001) {
        localStorage.removeItem("wt_bearer");
        window.location.href = "/login";
        return;
      }
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
