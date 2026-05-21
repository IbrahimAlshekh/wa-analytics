import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useStore } from "../lib/store";

export default function Register() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setToken = useStore((s) => s.setToken);

  useEffect(() => {
    api.setupStatus().then(({ hasUsers }) => {
      if (hasUsers) navigate("/login", { replace: true });
    }).catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.setupRegister(username, password);
      setToken(token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-brand-mark">W</div>
          <div className="login-brand-title">{t("auth.brand")}</div>
          <div className="login-brand-sub">{t("auth.register.subtitle")}</div>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="col" style={{ gap: 14 }}>
            <div className="form-field">
              <label className="form-label" htmlFor="reg-user">{t("auth.register.username")}</label>
              <input
                id="reg-user"
                className="input"
                placeholder={t("auth.register.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="reg-pass">{t("auth.register.password")}</label>
              <input
                id="reg-pass"
                className="input"
                type="password"
                placeholder={t("auth.register.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="reg-confirm">{t("auth.register.confirmPassword")}</label>
              <input
                id="reg-confirm"
                className="input"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? t("auth.register.submitting") : t("auth.register.submit")}
            </button>
          </form>
          {error && (
            <div className="error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
