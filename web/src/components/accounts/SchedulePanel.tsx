import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { ScheduleSlot } from "@/types/schedule";
import { minutesToTime, timeToMinutes } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SchedulePanelProps {
  accountId: number;
}

export default function SchedulePanel({ accountId }: SchedulePanelProps) {
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
    setSlots((prev) =>
      prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)),
    );
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
          <Label className="text-sm font-medium">
            {t("accounts.forceOffline")}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("accounts.forceOfflineDesc")}
          </p>
        </div>
        <Switch
          checked={forceOffline}
          onCheckedChange={(v) => {
            setForceOffline(v);
            setDirty(true);
          }}
        />
      </div>

      {!forceOffline && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {t("accounts.activeSlots")}
            <span className="ms-1 opacity-70">
              {t("accounts.emptySlotsHint")}
            </span>
          </p>
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Input
                type="time"
                className="h-8 w-28 text-sm"
                value={minutesToTime(s.startMin)}
                onChange={(e) =>
                  updateSlot(i, "startMin", timeToMinutes(e.target.value))
                }
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                className="h-8 w-28 text-sm"
                value={minutesToTime(s.endMin)}
                onChange={(e) =>
                  updateSlot(i, "endMin", timeToMinutes(e.target.value))
                }
              />
              {s.startMin >= s.endMin && (
                <Badge variant="secondary" className="text-xs">
                  {t("accounts.overnight")}
                </Badge>
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
          <Button
            variant="ghost"
            size="sm"
            className="self-start h-7 text-xs"
            onClick={addSlot}
          >
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
          <span className="text-xs text-destructive">
            {t("accounts.saveFailed")}
          </span>
        )}
        {save.isSuccess && !dirty && (
          <span className="text-xs text-muted-foreground">
            {t("accounts.saved")}
          </span>
        )}
      </div>
    </div>
  );
}
