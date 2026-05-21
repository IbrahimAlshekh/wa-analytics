import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useStore } from "../lib/store";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setToken = useStore((s) => s.setToken);

  useEffect(() => {
    api.setupStatus().then(({ hasUsers }) => {
      if (!hasUsers) navigate("/register", { replace: true });
    }).catch(() => {/* ignore — server may be starting */});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-brand-mark">W</div>
          <div className="login-brand-title">WA Tracker</div>
          <div className="login-brand-sub">Sign in to your account</div>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} className="col" style={{ gap: 14 }}>
            <div className="form-field">
              <label className="form-label" htmlFor="login-user">Username</label>
              <input
                id="login-user"
                className="input"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="login-pass">Password</label>
              <input
                id="login-pass"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? "Signing in…" : "Sign in"}
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
