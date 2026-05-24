import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import PresenceDaySection from "./PresenceDaySection";

const WINDOW_DAYS = 7;

function getISODate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDayLabel(isoDate: string, t: (k: string) => string): string {
  const now = new Date();
  const todayISO = getISODate(0);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayISO = getISODate(1);

  if (isoDate === todayISO) return t("timeline.today");
  if (isoDate === yesterdayISO) return t("timeline.yesterday");

  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export interface PresenceLogProps {
  accountId: number;
  contactId: number;
}

export default function PresenceLog({ accountId, contactId }: PresenceLogProps) {
  const { t } = useTranslation();
  const [totalDays, setTotalDays] = useState(WINDOW_DAYS);

  const dayList = Array.from({ length: totalDays }, (_, i) => getISODate(i));

  return (
    <div className="flex flex-col gap-3">
      {dayList.map((isoDate, i) => (
        <PresenceDaySection
          key={isoDate}
          accountId={accountId}
          contactId={contactId}
          isoDate={isoDate}
          label={getDayLabel(isoDate, t)}
          defaultOpen={i === 0}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="self-center gap-1.5 text-xs text-muted-foreground"
        onClick={() => setTotalDays((n) => n + WINDOW_DAYS)}
      >
        <ChevronDown className="size-3.5" />
        {t("timeline.loadMoreDays", { count: WINDOW_DAYS })}
      </Button>
    </div>
  );
}
