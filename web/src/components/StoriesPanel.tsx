import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Story } from "../lib/types";
import { getMediaUrl } from "../lib/media";

function formatDatetime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StoriesPanel({ accountId, contactId }: { accountId: number; contactId: number }) {
  const { t } = useTranslation();
  const { data: stories, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stories", accountId, contactId],
    queryFn: () => api.stories(accountId, contactId),
  });

  if (isLoading) {
    return <div className="muted" style={{ textAlign: "center", padding: "32px 0" }}>{t("stories.loading")}</div>;
  }
  if (error) {
    return <div className="error" style={{ padding: "8px 0" }}>{(error as Error).message}</div>;
  }
  if (!stories || stories.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div style={{ fontWeight: 500 }}>{t("stories.emptyTitle")}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {t("stories.emptyDesc")}
          </div>
          <button
            className="btn btn-sm btn-ghost"
            style={{ marginTop: 12 }}
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? t("stories.refreshing") : t("stories.refresh")}
          </button>
        </div>
      </div>
    );
  }

  // Group stories by date
  const groups = groupByDate(stories);

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="card" style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("stories.count", { count: stories.length })}</span>
        <button
          className="btn btn-sm btn-ghost"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          {isFetching ? t("stories.refreshing") : t("stories.refresh")}
        </button>
      </div>

      {groups.map(({ date, items }) => (
        <div key={date} className="col" style={{ gap: 12 }}>
          <div className="section-label">{date}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {items.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
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
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", cursor: hasMedia ? "pointer" : "default" }}
      onClick={() => hasMedia && setExpanded(true)}
    >
      {/* Media preview */}
      {isImage && story.mediaPath && (
        <img
          src={getMediaUrl(story.mediaPath)}
          alt={t("stories.storyAlt")}
          style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }}
        />
      )}
      {isVideo && story.mediaPath && (
        <div style={{ position: "relative", aspectRatio: "9/16", background: "#000" }}>
          <video
            src={getMediaUrl(story.mediaPath)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onClick={(e) => e.stopPropagation()}
            controls
          />
        </div>
      )}
      {isText && (
        <div
          style={{
            aspectRatio: "9/16",
            background: "linear-gradient(135deg, var(--accent-dim), var(--bg-subtle))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <span style={{ fontSize: 14, textAlign: "center", lineHeight: 1.5, fontWeight: 500 }}>
            {story.caption || <em className="muted">{t("stories.textStory")}</em>}
          </span>
        </div>
      )}
      {story.mediaType && !["image", "video"].includes(story.mediaType) && story.mediaPath && (
        <div
          style={{
            aspectRatio: "9/16",
            background: "var(--bg-subtle)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 32 }}>📄</span>
          <span className="muted" style={{ fontSize: 12 }}>{story.mediaType}</span>
          <a
            href={getMediaUrl(story.mediaPath)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {t("stories.download")}
          </a>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)" }}>
        {story.caption && !isText && (
          <div
            style={{
              fontSize: 12,
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {story.caption}
          </div>
        )}
        <div className="muted" style={{ fontSize: 10 }}>
          {formatDatetime(story.postedAt)}
        </div>
      </div>

      {/* Lightbox for images */}
      {expanded && isImage && story.mediaPath && (
        <Lightbox
          src={getMediaUrl(story.mediaPath)}
          caption={story.caption}
          time={formatDatetime(story.postedAt)}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

function Lightbox({ src, caption, time, onClose }: { src: string; caption?: string; time: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
      onClick={onClose}
    >
      <img
        src={src}
        alt={t("stories.mediaAlt")}
        style={{ maxHeight: "80vh", maxWidth: "90vw", objectFit: "contain", borderRadius: 8 }}
        onClick={(e) => e.stopPropagation()}
      />
      <div style={{ textAlign: "center" }}>
        {caption && <div style={{ color: "#fff", fontSize: 14, marginBottom: 4 }}>{caption}</div>}
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{time}</div>
      </div>
      <button
        style={{
          position: "fixed",
          top: 16,
          right: 20,
          background: "none",
          border: "none",
          color: "#fff",
          fontSize: 28,
          cursor: "pointer",
          lineHeight: 1,
        }}
        onClick={onClose}
      >
        ×
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
