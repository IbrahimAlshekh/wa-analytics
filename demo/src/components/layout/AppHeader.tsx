import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import logoSrc from "@/assets/wa_analytics_logo_512.png";

const publicPaths = ["/login", "/register"];

export default function AppHeader() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setToken, backupState, setBackupState } = useStore();

  const authed = Boolean(token);
  const isPublic = publicPaths.includes(location.pathname);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  }

  async function triggerBackup() {
    if (backupState === "loading") return;
    setBackupState("loading");
    try {
      const res = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupState("idle");
    } catch {
      setBackupState("error");
      setTimeout(() => setBackupState("idle"), 3000);
    }
  }

  return (
    <header className="sticky top-0 z-50 h-14 shrink-0 flex items-center gap-3 px-5 border-b border-border bg-card/90 backdrop-blur-md">
      <Link
        to="/"
        className="flex items-center gap-2.5 text-foreground font-bold tracking-tight shrink-0 hover:opacity-80 transition-opacity no-underline"
      >
        <img
          src={logoSrc}
          alt="WA Analytics"
          className="size-7 rounded-lg object-contain"
        />
        {!isPublic && (
          <span className="text-sm font-semibold">{t("app.name")}</span>
        )}
      </Link>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        title={t("lang.switchTo")}
        className="gap-1.5 text-muted-foreground hover:text-foreground h-8"
      >
        <Globe className="size-3.5" />
        <span className="text-xs font-medium">
          {i18n.language === "ar" ? t("lang.en") : t("lang.ar")}
        </span>
      </Button>

      {authed && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerBackup}
            disabled={backupState === "loading"}
            title={t("app.backupTitle")}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-8"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline text-xs">
              {backupState === "loading"
                ? t("app.backingUp")
                : backupState === "error"
                ? t("app.backupFailed")
                : t("app.backup")}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setToken(null);
              navigate("/login");
            }}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-8"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline text-xs">{t("app.logout")}</span>
          </Button>
        </>
      )}
    </header>
  );
}
