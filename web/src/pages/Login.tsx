import { useState } from "react";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";

export default function Login() {
  const [tab, setTab] = useState<"qr" | "phone">("qr");
  return (
    <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Link your WhatsApp</h2>
      <div className="tabs">
        <button
          className="btn"
          aria-current={tab === "qr"}
          onClick={() => setTab("qr")}
        >
          QR code
        </button>
        <button
          className="btn"
          aria-current={tab === "phone"}
          onClick={() => setTab("phone")}
        >
          Phone code
        </button>
      </div>
      {tab === "qr" ? <QRView /> : <PhoneCodeView />}
    </div>
  );
}
