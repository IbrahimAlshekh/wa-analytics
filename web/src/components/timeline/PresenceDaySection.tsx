import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { buildBlocks } from "@/lib/sessions";
import { cn } from "@/lib/utils";
import SessionBlock from "./SessionBlock";
import GapBlock from "./GapBlock";
import EventBlock from "./EventBlock";

export interface PresenceDaySectionProps {
  accountId: number;
  contactId: number;
  isoDate: string;
  label: string;
  defaultOpen?: boolean;
}

function dayBounds(isoDate: string): { start: number; end: number } {
  const d = new Date(`${isoDate}T00:00:00`);
  const start = Math.floor(d.getTime() / 1000);
  return { start, end: start + 86400 };
}

export default function PresenceDaySection({
  accountId,
  contactId,
  isoDate,
  label,
  defaultOpen = false,
}: PresenceDaySectionProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { start, end } = dayBounds(isoDate);

  const q = useQuery({
    queryKey: ["presence-day", accountId, contactId, isoDate],
    queryFn: () => api.presenceDay(accountId, contactId, start, end),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const blocks = useMemo(() => {
    if (!q.data) return [];
    const statusEntries = q.data.filter((e) => e.kind !== "message");
    return buildBlocks(statusEntries);
  }, [q.data]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 mb-2">
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap hover:text-foreground transition-colors">
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-150",
              isOpen && "rotate-90",
            )}
          />
          {label}
        </CollapsibleTrigger>
        <div className="flex-1 h-px bg-border" />
      </div>

      <CollapsibleContent>
        <div className="mb-4">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse pl-4">
              {t("timeline.loading")}
            </p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-4">
              {t("timeline.noActivity")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {blocks.map((b, i) => {
                if (b.type === "session")
                  return <SessionBlock key={i} session={b.session} />;
                if (b.type === "offline-gap")
                  return <GapBlock key={i} fromAt={b.fromAt} toAt={b.toAt} />;
                return <EventBlock key={i} ev={b.ev} />;
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
