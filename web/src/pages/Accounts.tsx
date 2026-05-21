import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X, Smartphone, RefreshCw, Calendar, Trash2, Pencil } from "lucide-react";
import { api } from "../lib/api";
import type { Account, ScheduleSlot } from "../lib/types";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";
import { useStore } from "../lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function Accounts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { accounts: storeAccounts, setAccounts, upsertAccount, removeAccount } = useStore();
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
  const [showPair, setShowPair] = useState(false);

  useEffect(() => {
    if (accountsQ.data) setAccounts(accountsQ.data);
  }, [accountsQ.data, setAccounts]);

  const toggle = useMutation({
    mutationFn: ({ id, trackingActive }: { id: number; trackingActive: boolean }) =>
      api.updateAccount(id, { trackingActive }),
    onSuccess: (updated) => {
      upsertAccount(updated);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAccount(id),
    onSuccess: (_, id) => {
      removeAccount(id);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const list: Account[] = storeAccounts.length > 0 ? storeAccounts : (accountsQ.data ?? []);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight">{t("accounts.title")}</h2>
        <Button
          variant={showPair ? "ghost" : "default"}
          size="sm"
          onClick={() => setShowPair((v) => !v)}
        >
          {showPair ? <><X className="size-3.5 me-1.5" />{t("accounts.cancel")}</> : <><Plus className="size-3.5 me-1.5" />{t("accounts.addAccount")}</>}
        </Button>
      </div>

      {showPair && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("accounts.linkTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr">
              <TabsList className="mb-4">
                <TabsTrigger value="qr">{t("accounts.qrTab")}</TabsTrigger>
                <TabsTrigger value="phone">{t("accounts.phoneTab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="qr"><QRView /></TabsContent>
              <TabsContent value="phone"><PhoneCodeView /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {list.length === 0 && !showPair && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Smartphone className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-sm">{t("accounts.emptyTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("accounts.emptyDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {list.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {list.map((acc) => (
              <AccountRow
                key={acc.id}
                account={acc}
                onToggle={(v) => toggle.mutate({ id: acc.id, trackingActive: v })}
                onDelete={() => {
                  if (confirm(t("accounts.removeConfirm", { name: acc.label || acc.jid })))
                    remove.mutate(acc.id);
                }}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AccountRow({
  account,
  onToggle,
  onDelete,
}: {
  account: Account;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const upsertAccount = useStore((s) => s.upsertAccount);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(account.label);
  const [showSchedule, setShowSchedule] = useState(false);

  const saveLabel = useMutation({
    mutationFn: () => api.updateAccount(account.id, { label }),
    onSuccess: (updated) => {
      upsertAccount(updated);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const initials = (account.label || account.jid || "?").slice(0, 2).toUpperCase();

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <Avatar size="sm">
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                account.connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className={cn(
            "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card",
            account.connected ? "bg-primary" : "bg-muted-foreground/40",
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <Link
            to={`/accounts/${account.id}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
          >
            {account.label || account.jid}
          </Link>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Input
                className="h-6 text-xs w-40"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
              <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveLabel.mutate()}>
                {t("accounts.save")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => { setLabel(account.label); setEditing(false); }}
              >
                {t("accounts.cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-muted-foreground truncate">{account.jid}</span>
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Switch
            checked={account.trackingActive}
            onCheckedChange={onToggle}
            title={account.trackingActive ? t("accounts.trackingOn") : t("accounts.trackingOff")}
          />
          <Button
            variant={showSchedule ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs hidden sm:flex"
            onClick={() => setShowSchedule((v) => !v)}
          >
            <Calendar className="size-3.5 me-1" />
            {t("accounts.schedule")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {showSchedule && (
        <>
          <Separator />
          <SchedulePanel accountId={account.id} />
        </>
      )}
    </div>
  );
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function SchedulePanel({ accountId }: { accountId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const schedule = useQuery({
    queryKey: ["schedule", accountId],
    queryFn: () => api.getSchedule(accountId),
  });

  const [forceOffline, setForceOffline] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (schedule.data) {
      setForceOffline(schedule.data.forceOffline);
      setSlots(schedule.data.slots);
      setDirty(false);
    }
  }, [schedule.data]);

  const save = useMutation({
    mutationFn: () => api.putSchedule(accountId, forceOffline, slots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", accountId] });
      setDirty(false);
    },
  });

  function addSlot() {
    setSlots((prev) => [...prev, { id: 0, startMin: 9 * 60, endMin: 17 * 60 }]);
    setDirty(true);
  }

  function removeSlot(i: number) {
    setSlots((prev) => prev.filter((_, j) => j !== i));
    setDirty(true);
  }

  function updateSlot(i: number, field: "startMin" | "endMin", value: number) {
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
    setDirty(true);
  }

  if (schedule.isLoading) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <RefreshCw className="size-3.5 animate-spin" />
        {t("accounts.loadingSchedule")}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4 bg-muted/30">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("accounts.connectionSchedule")}
      </p>

      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="text-sm font-medium">{t("accounts.forceOffline")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t("accounts.forceOfflineDesc")}</p>
        </div>
        <Switch
          checked={forceOffline}
          onCheckedChange={(v) => { setForceOffline(v); setDirty(true); }}
        />
      </div>

      {!forceOffline && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {t("accounts.activeSlots")}
            <span className="ms-1 opacity-70">{t("accounts.emptySlotsHint")}</span>
          </p>
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Input
                type="time"
                className="h-8 w-28 text-sm"
                value={minutesToTime(s.startMin)}
                onChange={(e) => updateSlot(i, "startMin", timeToMinutes(e.target.value))}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                className="h-8 w-28 text-sm"
                value={minutesToTime(s.endMin)}
                onChange={(e) => updateSlot(i, "endMin", timeToMinutes(e.target.value))}
              />
              {s.startMin >= s.endMin && (
                <Badge variant="secondary" className="text-xs">{t("accounts.overnight")}</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 ms-auto"
                onClick={() => removeSlot(i)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start h-7 text-xs" onClick={addSlot}>
            <Plus className="size-3.5 me-1" />
            {t("accounts.addSlot")}
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t("accounts.saving") : t("accounts.save")}
        </Button>
        {save.isError && (
          <span className="text-xs text-destructive">{t("accounts.saveFailed")}</span>
        )}
        {save.isSuccess && !dirty && (
          <span className="text-xs text-muted-foreground">{t("accounts.saved")}</span>
        )}
      </div>
    </div>
  );
}
