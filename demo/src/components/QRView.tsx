import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { RefreshCw, QrCode } from "lucide-react";
import { api } from "../lib/api";
import { ws } from "../lib/ws";
import { Button } from "@/components/ui/button";

export default function QRView() {
  const { t } = useTranslation();
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
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground text-center">{t("qr.instruction")}</p>
      <div className="size-64 flex items-center justify-center rounded-xl border border-border bg-white p-3">
        {code ? (
          <QRCodeSVG value={code} size={232} level="M" />
        ) : (
          <QrCode className="size-16 text-muted-foreground/30" />
        )}
      </div>
      <Button onClick={start} disabled={starting}>
        {starting ? (
          <><RefreshCw className="size-3.5 me-1.5 animate-spin" />{t("qr.generate")}</>
        ) : code ? (
          <><RefreshCw className="size-3.5 me-1.5" />{t("qr.refresh")}</>
        ) : (
          t("qr.generate")
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
