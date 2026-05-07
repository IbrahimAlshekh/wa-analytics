import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import { ws } from "../lib/ws";

export default function QRView() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function start() {
    setError(null);
    setStarting(true);
    try {
      await api.startQR();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    const off = ws.on((msg) => {
      if (msg.type === "auth.qr") setCode(msg.code);
    });
    return off;
  }, []);

  return (
    <div className="col" style={{ alignItems: "center" }}>
      <p className="muted">
        Open WhatsApp on your phone → Linked devices → Link a device.
      </p>
      {code ? (
        <div className="qr">
          <QRCodeSVG value={code} size={232} level="M" />
        </div>
      ) : (
        <div className="qr" style={{ width: 264, height: 264 }} />
      )}
      <button className="btn btn-primary" onClick={start} disabled={starting}>
        {code ? "Refresh" : "Generate QR"}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
