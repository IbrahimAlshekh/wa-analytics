import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { Story } from "@/types/story";
import { formatDate } from "@/lib/presence-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StoryCard from "./StoryCard";

export interface StoriesPanelProps {
  accountId: number;
  contactId: number;
}

function groupByDate(stories: Story[]): { date: string; items: Story[] }[] {
  const map = new Map<string, Story[]>();
  for (const s of stories) {
    const d = formatDate(s.postedAt);
    const list = map.get(d) ?? [];
    list.push(s);
    map.set(d, list);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export default function StoriesPanel({
  accountId,
  contactId,
}: StoriesPanelProps) {
  const { t } = useTranslation();
  const {
    data: stories,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["stories", accountId, contactId],
    queryFn: () => api.stories(accountId, contactId),
  });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("stories.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-sm text-destructive py-2">
        {(error as Error).message}
      </div>
    );
  }
  if (!stories || stories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BookOpen className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-sm">{t("stories.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("stories.emptyDesc")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? (
              <>
                <RefreshCw className="size-3.5 me-1.5 animate-spin" />
                {t("stories.refreshing")}
              </>
            ) : (
              t("stories.refresh")
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByDate(stories);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("stories.count", { count: stories.length })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={isFetching}
          onClick={() => refetch()}
          className="h-7 text-xs"
        >
          {isFetching ? (
            <>
              <RefreshCw className="size-3.5 me-1.5 animate-spin" />
              {t("stories.refreshing")}
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5 me-1.5" />
              {t("stories.refresh")}
            </>
          )}
        </Button>
      </div>

      {groups.map(({ date, items }) => (
        <div key={date} className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {date}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {items.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
