import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw, BookOpen, X } from "lucide-react";
import { api } from "../lib/api";
import type { Story } from "../lib/types";
import { getMediaUrl } from "../lib/media";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDatetime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function StoriesPanel({ accountId, contactId }: { accountId: number; contactId: number }) {
  const { t } = useTranslation();
  const { data: stories, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stories", accountId, contactId],
    queryFn: () => api.stories(accountId, contactId),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">{t("stories.loading")}</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive py-2">{(error as Error).message}</div>;
  }
  if (!stories || stories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BookOpen className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-sm">{t("stories.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("stories.emptyDesc")}</p>
          </div>
          <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <><RefreshCw className="size-3.5 me-1.5 animate-spin" />{t("stories.refreshing")}</> : t("stories.refresh")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByDate(stories);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("stories.count", { count: stories.length })}</span>
        <Button variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()} className="h-7 text-xs">
          {isFetching ? <><RefreshCw className="size-3.5 me-1.5 animate-spin" />{t("stories.refreshing")}</> : <><RefreshCw className="size-3.5 me-1.5" />{t("stories.refresh")}</>}
        </Button>
      </div>

      {groups.map(({ date, items }) => (
        <div key={date} className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{date}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {items.map((s) => <StoryCard key={s.id} story={s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryCard({ story }: { story: Story }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hasMedia = Boolean(story.mediaPath);
  const isVideo = story.mediaType === "video";
  const isImage = story.mediaType === "image";
  const isText = !story.mediaType || story.mediaType === "";

  return (
    <>
      <div
        className="rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => hasMedia && setExpanded(true)}
      >
        {isImage && story.mediaPath && (
          <img
            src={getMediaUrl(story.mediaPath)}
            alt={t("stories.storyAlt")}
            className="w-full aspect-[9/16] object-cover block"
          />
        )}
        {isVideo && story.mediaPath && (
          <div className="relative aspect-[9/16] bg-black">
            <video
              src={getMediaUrl(story.mediaPath)}
              className="w-full h-full object-cover"
              onClick={(e) => e.stopPropagation()}
              controls
            />
          </div>
        )}
        {isText && (
          <div className="aspect-[9/16] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center p-4">
            <span className="text-sm text-center leading-relaxed font-medium">
              {story.caption || <em className="text-muted-foreground not-italic">{t("stories.textStory")}</em>}
            </span>
          </div>
        )}
        {story.mediaType && !["image", "video", ""].includes(story.mediaType) && story.mediaPath && (
          <div className="aspect-[9/16] bg-muted flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">📄</span>
            <span className="text-xs text-muted-foreground">{story.mediaType}</span>
            <a
              href={getMediaUrl(story.mediaPath)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t("stories.download")}
            </a>
          </div>
        )}

        <div className="px-2.5 py-2 border-t border-border">
          {story.caption && !isText && (
            <p className="text-xs truncate mb-0.5">{story.caption}</p>
          )}
          <p className="text-xs text-muted-foreground">{formatDatetime(story.postedAt)}</p>
        </div>
      </div>

      {expanded && isImage && story.mediaPath && (
        <Lightbox
          src={getMediaUrl(story.mediaPath)}
          caption={story.caption}
          time={formatDatetime(story.postedAt)}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

function Lightbox({ src, caption, time, onClose }: { src: string; caption?: string; time: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center gap-3"
      onClick={onClose}
    >
      <img
        src={src}
        alt={t("stories.mediaAlt")}
        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="text-center">
        {caption && <p className="text-white text-sm mb-1">{caption}</p>}
        <p className="text-white/60 text-xs">{time}</p>
      </div>
      <button
        className="fixed top-4 end-5 text-white text-2xl leading-none hover:opacity-70 transition-opacity"
        onClick={onClose}
      >
        <X className="size-6" />
      </button>
    </div>
  );
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
