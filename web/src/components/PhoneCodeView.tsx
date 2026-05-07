import { useState } from "react";
import { api } from "../lib/api";

export default function PhoneCodeView() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.pairPhone(phone);
      setCode(res.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="col">
      <p className="muted">
        Enter your phone in international format (e.g. +14155551234). Then in
        WhatsApp: Linked devices → Link a device → Link with phone number
        instead.
      </p>
      <input
        className="input"
        placeholder="+14155551234"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button
        className="btn btn-primary"
        type="submit"
        disabled={!phone || loading}
      >
        {loading ? "Generating…" : "Get pairing code"}
      </button>
      {code && (
        <div className="col" style={{ alignItems: "center", marginTop: 16 }}>
          <span className="muted">Enter this code on your phone:</span>
          <span className="code">
            {code.match(/.{1,4}/g)?.join(" ") ?? code}
          </span>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
