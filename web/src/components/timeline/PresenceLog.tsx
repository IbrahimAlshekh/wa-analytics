import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import PresenceDaySection from "./PresenceDaySection";

const PAGE_SIZE = 7;

function getDayLabel(isoDate: string, t: (k: string) => string): string {
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10);
  const yesterdayUTC = new Date(now.getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  if (isoDate === todayUTC) return t("timeline.today");
  if (isoDate === yesterdayUTC) return t("timeline.yesterday");

  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}),
  });
}

export interface PresenceLogProps {
  accountId: number;
  contactId: number;
}

export default function PresenceLog({ accountId, contactId }: PresenceLogProps) {
  const { t } = useTranslation();

  const daysQ = useInfiniteQuery({
    queryKey: ["presence-days", accountId, contactId],
    queryFn: ({ pageParam }) =>
      api.presenceDays(accountId, contactId, pageParam, PAGE_SIZE),
    initialPageParam: Math.floor(Date.now() / 1000),
    getNextPageParam: (lastPage) => {
      if (lastPage.days.length < PAGE_SIZE) return undefined;
      const oldest = lastPage.days[lastPage.days.length - 1];
      return Math.floor(new Date(`${oldest}T00:00:00Z`).getTime() / 1000);
    },
    staleTime: 60_000,
  });

  const allDays = daysQ.data?.pages.flatMap((p) => p.days) ?? [];

  if (daysQ.isLoading) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse">
        {t("timeline.loading")}
      </p>
    );
  }

  if (allDays.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("timeline.noSessions")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {allDays.map((isoDate, i) => (
        <PresenceDaySection
          key={isoDate}
          accountId={accountId}
          contactId={contactId}
          isoDate={isoDate}
          label={getDayLabel(isoDate, t)}
          defaultOpen={i === 0}
        />
      ))}

      {daysQ.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center gap-1.5 text-xs text-muted-foreground"
          onClick={() => daysQ.fetchNextPage()}
          disabled={daysQ.isFetchingNextPage}
        >
          <ChevronDown className="size-3.5" />
          {daysQ.isFetchingNextPage
            ? t("timeline.loading")
            : t("timeline.loadMoreDays", { count: PAGE_SIZE })}
        </Button>
      )}
    </div>
  );
}
