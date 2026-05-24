import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import type { Account } from "@/types/account";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import SchedulePanel from "./SchedulePanel";

export interface AccountRowProps {
  account: Account;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}

export default function AccountRow({
  account,
  onToggle,
  onDelete,
}: AccountRowProps) {
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

  const initials = (account.label || account.jid || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative shrink-0">
          <Avatar size="sm">
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                account.connected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -inset-e-0.5 size-2.5 rounded-full border-2 border-card",
              account.connected ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
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
              <Button
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => saveLabel.mutate()}
              >
                {t("accounts.save")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  setLabel(account.label);
                  setEditing(false);
                }}
              >
                {t("accounts.cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-muted-foreground truncate">
                {account.jid}
              </span>
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
            title={
              account.trackingActive
                ? t("accounts.trackingOn")
                : t("accounts.trackingOff")
            }
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
