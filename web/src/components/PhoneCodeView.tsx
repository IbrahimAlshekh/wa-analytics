import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("phone.instruction")}</p>
      <div className="flex flex-col gap-1.5">
        <Label>{t("phone.placeholder")}</Label>
        <Input
          placeholder={t("phone.placeholder")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={!phone || loading} className="self-start">
        {loading ? t("phone.generating") : t("phone.get")}
      </Button>
      {code && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">
            {t("phone.enterCode")}
          </span>
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">
            {code.match(/.{1,4}/g)?.join(" ") ?? code}
          </span>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
