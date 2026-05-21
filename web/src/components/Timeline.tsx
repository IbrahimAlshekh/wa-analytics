import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineEntry } from "../lib/types";
import { getMediaUrl } from "../lib/media";

interface Props {
  entries: TimelineEntry[];
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

// A session is one online period.
interface Session {
  startAt: number;
  endAt: number | null; // null = still online
  lastSeen: number | null;
  durationSec: number | null;
}

// A non-presence event (picture / about change).
interface NonPresence {
  kind: "picture" | "about";
  at: number;
  text?: string;
  mediaPath?: string;
}

type Block =
  | { type: "session"; session: Session }
  | { type: "offline-gap"; fromAt: number; toAt: number }
  | { type: "event"; ev: NonPresence };

export default function SessionTimeline({ entries }: Props) {
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
                    {e.isFromMe ? t("timeline.sent") : t("timeline.received")}:{" "}
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

// ---------------------------------------------------------------------------
// Build display blocks from raw timeline entries.

function buildBlocks(entries: TimelineEntry[]): Block[] {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  const nonPresence: NonPresence[] = entries
    .filter((e) => e.kind === "picture" || e.kind === "about")
    .map((e) => ({
      kind: e.kind as "picture" | "about",
      at: e.at,
      text: e.text,
      mediaPath: e.mediaPath,
    }))
    .sort((a, b) => a.at - b.at);

  // Pair online→offline into sessions.
  const sessions: Session[] = [];
  let sessionStart: number | null = null;
  let sessionLastSeen: number | null = null;
  let lastOfflineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      // Keep the FIRST "available" as the session start; consecutive available
      // events (from message receipts or resub noise) must not push it forward.
      if (sessionStart === null) sessionStart = p.at;
      sessionLastSeen = null;
    } else if (p.state === "unavailable" && sessionStart != null) {
      const dur = p.at - sessionStart;
      sessions.push({
        startAt: sessionStart,
        endAt: p.at,
        lastSeen: p.lastSeen ?? null,
        durationSec: dur,
      });
      sessionStart = null;
      sessionLastSeen = null;
      lastOfflineAt = p.at;
    } else if (p.state === "unavailable") {
      // Standalone unavailable (no prior available in this window)
      lastOfflineAt = p.at;
    }
  }
  // Currently online
  if (sessionStart != null) {
    sessions.push({
      startAt: sessionStart,
      endAt: null,
      lastSeen: sessionLastSeen,
      durationSec: null,
    });
    // Clear offline marker — currently online
    lastOfflineAt = null;
  }

  // Merge sessions whose gap is under MERGE_GAP_SEC into a single session.
  // This removes noise from rapid WhatsApp presence flapping.
  const MERGE_GAP_SEC = 120;
  const merged: Session[] = [];
  for (const s of sessions) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.endAt != null &&
      s.startAt - prev.endAt <= MERGE_GAP_SEC
    ) {
      // Extend previous session to cover this one.
      prev.endAt = s.endAt;
      prev.durationSec =
        prev.endAt != null ? prev.endAt - prev.startAt : null;
      prev.lastSeen = s.lastSeen ?? prev.lastSeen;
    } else {
      merged.push({ ...s });
    }
  }

  // Build alternating blocks: offline-gap then session.
  const blocks: Block[] = [];
  for (let i = 0; i < merged.length; i++) {
    const prev = merged[i - 1];
    const cur = merged[i];
    if (prev && prev.endAt != null) {
      const gapSec = cur.startAt - prev.endAt;
      if (gapSec > 30) {
        blocks.push({ type: "offline-gap", fromAt: prev.endAt, toAt: cur.startAt });
      }
    }
    blocks.push({ type: "session", session: cur });
  }

  // Interleave non-presence events at their natural position.
  const mixed: Block[] = [];
  let bi = 0;
  for (const ev of nonPresence) {
    while (bi < blocks.length) {
      const b = blocks[bi];
      const bAt =
        b.type === "session"
          ? b.session.startAt
          : b.type === "offline-gap"
            ? b.fromAt
            : b.ev.at;
      if (bAt > ev.at) break;
      mixed.push(blocks[bi++]);
    }
    mixed.push({ type: "event", ev });
  }
  while (bi < blocks.length) mixed.push(blocks[bi++]);

  // Reverse so newest is at top.
  const reversed = mixed.reverse();

  // If the person is currently offline (no open session), prepend an indicator.
  if (lastOfflineAt != null) {
    const offlineSince = Math.floor(Date.now() / 1000 - lastOfflineAt);
    const offlineBlock: Block = {
      type: "offline-gap",
      fromAt: lastOfflineAt,
      toAt: Math.floor(Date.now() / 1000),
    };
    // Only prepend if it's a meaningful gap (>30s) and not already shown.
    if (offlineSince > 30) {
      return [offlineBlock, ...reversed];
    }
  }

  return reversed;
}

// ---------------------------------------------------------------------------
// Helpers

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
