import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { Block } from "@/types/session";
import { groupBlocksByDay } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import SessionBlock from "./SessionBlock";
import GapBlock from "./GapBlock";
import EventBlock from "./EventBlock";

const INITIAL_DAYS = 5;
const PAGE_DAYS = 5;

function getDayLabel(isoDate: string, t: (k: string) => string): string {
  const now = new Date();
  const todayISO = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayISO = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, "0"),
    String(yesterday.getDate()).padStart(2, "0"),
  ].join("-");

  if (isoDate === todayISO) return t("timeline.today");
  if (isoDate === yesterdayISO) return t("timeline.yesterday");

  // Use noon to avoid DST edge cases
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export interface PresenceLogProps {
  blocks: Block[];
}

export default function PresenceLog({ blocks }: PresenceLogProps) {
  const { t } = useTranslation();
  const [visibleDays, setVisibleDays] = useState(INITIAL_DAYS);

  if (blocks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("timeline.noSessions")}
      </div>
    );
  }

  const dayGroups = groupBlocksByDay(blocks);
  const visible = dayGroups.slice(0, visibleDays);
  const remaining = dayGroups.length - visibleDays;

  return (
    <div className="flex flex-col gap-5">
      {visible.map(({ isoDate, blocks: dayBlocks }) => (
        <div key={isoDate}>
          {/* Date divider */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              {getDayLabel(isoDate, t)}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Blocks for this day */}
          <div className="flex flex-col gap-1.5">
            {dayBlocks.map((b, i) => {
              if (b.type === "session")
                return <SessionBlock key={i} session={b.session} />;
              if (b.type === "offline-gap")
                return (
                  <GapBlock key={i} fromAt={b.fromAt} toAt={b.toAt} />
                );
              return <EventBlock key={i} ev={b.ev} />;
            })}
          </div>
        </div>
      ))}

      {remaining > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center gap-1.5 text-xs text-muted-foreground"
          onClick={() => setVisibleDays((n) => n + PAGE_DAYS)}
        >
          <ChevronDown className="size-3.5" />
          {t("timeline.showMore", {
            count: Math.min(PAGE_DAYS, remaining),
          })}
        </Button>
      )}
    </div>
  );
}
