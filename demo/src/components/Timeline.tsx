import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "../lib/types";
import { buildBlocks, formatTime } from "../lib/sessions";
import MediaPreview from "./timeline/MediaPreview";
import SessionBlock from "./timeline/SessionBlock";
import GapBlock from "./timeline/GapBlock";
import EventBlock from "./timeline/EventBlock";

interface Props {
  entries: TimelineEntry[];
  contactName: string;
}

export default function SessionTimeline({ entries, contactName }: Props) {
  const { t } = useTranslation();

  if (!entries?.length) {
    return <div className="text-sm text-muted-foreground">{t("timeline.noEvents")}</div>;
  }

  const messages = entries
    .filter((e) => e.kind === "message")
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);

  const statusEntries = entries.filter((e) => e.kind !== "message");
  const blocks = buildBlocks(statusEntries);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("timeline.recentMessages")}</p>
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("timeline.noMessages")}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((e, i) => (
              <div key={i} className="flex items-start gap-2 py-1 text-sm">
                <time className="text-xs text-muted-foreground shrink-0 min-w-12">{formatTime(e.at)}</time>
                <div className="flex flex-col">
                  <span>
                    {e.isFromMe ? t("analytics.you") : contactName}:{" "}
                    <em className="not-italic text-foreground">
                      {e.text || (e.mediaPath ? "" : <span className="text-muted-foreground">[{e.mediaType || "media"}]</span>)}
                    </em>
                  </span>
                  {e.mediaPath && <MediaPreview type={e.mediaType} path={e.mediaPath} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("timeline.statusSection")}</p>
        {blocks.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("timeline.noSessions")}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {blocks.map((b, i) => {
              if (b.type === "session") return <SessionBlock key={i} session={b.session} />;
              if (b.type === "offline-gap") return <GapBlock key={i} fromAt={b.fromAt} toAt={b.toAt} />;
              return <EventBlock key={i} ev={b.ev} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
