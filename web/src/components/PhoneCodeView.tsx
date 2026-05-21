import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

export default function PhoneCodeView() {
  const { t } = useTranslation();
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
        {t("phone.instruction")}
      </p>
      <input
        className="input"
        placeholder={t("phone.placeholder")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button
        className="btn btn-primary"
        type="submit"
        disabled={!phone || loading}
      >
        {loading ? t("phone.generating") : t("phone.get")}
      </button>
      {code && (
        <div className="col" style={{ alignItems: "center", marginTop: 16 }}>
          <span className="muted">{t("phone.enterCode")}</span>
          <span className="code">
            {code.match(/.{1,4}/g)?.join(" ") ?? code}
          </span>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
