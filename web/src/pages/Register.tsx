import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

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
    api
      .setupStatus()
      .then(({ hasUsers }) => {
        if (hasUsers) navigate("/login", { replace: true });
      })
      .catch(() => {});
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
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-16">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary">
            W
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {t("auth.brand")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.register.subtitle")}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-user">{t("auth.register.username")}</Label>
                <Input
                  id="reg-user"
                  placeholder={t("auth.register.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-pass">{t("auth.register.password")}</Label>
                <Input
                  id="reg-pass"
                  type="password"
                  placeholder={t("auth.register.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-confirm">
                  {t("auth.register.confirmPassword")}
                </Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full mt-1" disabled={loading}>
                {loading
                  ? t("auth.register.submitting")
                  : t("auth.register.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 text-center text-[10px] leading-relaxed text-muted-foreground/60 max-w-[300px] mx-auto">
          <p className="font-semibold uppercase tracking-wider text-[9px]">
            {t("auth.disclaimer.title")}
          </p>
          <p>{t("auth.disclaimer.text")}</p>
        </div>
      </div>
    </div>
  );
}
