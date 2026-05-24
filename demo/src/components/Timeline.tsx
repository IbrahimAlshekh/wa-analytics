import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "../lib/types";
import { getMediaUrl } from "../lib/media";
import { buildBlocks, formatTime, formatDuration } from "../lib/sessions";
import type { Session, NonPresence } from "../lib/sessions";

interface Props {
  entries: TimelineEntry[];
  contactName: string;
}

function MediaPreview({ type, path }: { type?: string; path: string }) {
  const { t } = useTranslation();
  const url = useMemo(() => getMediaUrl(path), [path]);

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={url}
          alt="WhatsApp Media"
          className="max-w-48 max-h-36 rounded object-cover block mt-1"
        />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
      {t("timeline.viewMedia", { type: type || "media" })}
    </a>
  );
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

function SessionBlock({ session }: { session: Session }) {
  const { t } = useTranslation();
  const start = formatTime(session.startAt);
  const end = session.endAt ? formatTime(session.endAt) : t("contactDetail.nowLabel");
  const dur = session.durationSec != null ? formatDuration(session.durationSec) : null;
  const lastSeenDiff =
    session.lastSeen != null && session.endAt != null
      ? session.endAt - session.lastSeen
      : null;

  return (
    <div className="flex items-start gap-2 py-1.5 px-3 rounded-md bg-primary/5 border border-primary/10">
      <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
      <div className="flex flex-col">
        <span className="text-sm">
          {t("timeline.onlineSession", { start, end })}
          {dur ? <span className="text-xs text-muted-foreground ms-1">({dur})</span> : null}
        </span>
        {lastSeenDiff != null && lastSeenDiff > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 ms-4">
            {t("timeline.lastActivity", { duration: formatDuration(lastSeenDiff) })}
          </p>
        )}
      </div>
    </div>
  );
}

function GapBlock({ fromAt, toAt }: { fromAt: number; toAt: number }) {
  const { t } = useTranslation();
  const dur = formatDuration(toAt - fromAt);
  return (
    <div className="flex items-center gap-2 py-1 px-3 text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
      <span className="text-sm text-muted-foreground">{t("timeline.offlineGap", { duration: dur })}</span>
    </div>
  );
}

function EventBlock({ ev }: { ev: NonPresence }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <time className="text-xs text-muted-foreground shrink-0 min-w-12">{formatTime(ev.at)}</time>
      {ev.kind === "picture" ? (
        <span>
          {t("timeline.picChanged")}
          {ev.mediaPath ? (
            <> <a href={getMediaUrl(ev.mediaPath)} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">{t("timeline.view")}</a></>
          ) : null}
        </span>
      ) : (
        <span>{t("timeline.aboutUpdated")} <em>{ev.text || t("timeline.aboutEmpty")}</em></span>
      )}
    </div>
  );
}

