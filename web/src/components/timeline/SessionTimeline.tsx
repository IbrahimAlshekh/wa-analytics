import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "@/types/timeline";
import { buildBlocks, formatTime } from "@/lib/sessions";
import MediaPreview from "./MediaPreview";
import PresenceLog from "./PresenceLog";

export interface SessionTimelineProps {
  entries: TimelineEntry[];
  contactName: string;
}

export default function SessionTimeline({
  entries,
  contactName,
}: SessionTimelineProps) {
  const { t } = useTranslation();

  if (!entries?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("timeline.noEvents")}
      </div>
    );
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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t("timeline.recentMessages")}
        </p>
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("timeline.noMessages")}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((e, i) => (
              <div key={i} className="flex items-start gap-2 py-1 text-sm">
                <time className="text-xs text-muted-foreground shrink-0 min-w-12">
                  {formatTime(e.at)}
                </time>
                <div className="flex flex-col">
                  <span>
                    {e.isFromMe ? t("analytics.you") : contactName}:{" "}
                    <em className="not-italic text-foreground">
                      {e.text ||
                        (e.mediaPath ? (
                          ""
                        ) : (
                          <span className="text-muted-foreground">
                            [{e.mediaType || "media"}]
                          </span>
                        ))}
                    </em>
                  </span>
                  {e.mediaPath && (
                    <MediaPreview type={e.mediaType} path={e.mediaPath} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t("timeline.statusSection")}
        </p>
        <PresenceLog blocks={blocks} />
      </div>
    </div>
  );
}
