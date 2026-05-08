import { useMemo } from "react";
import type { TimelineEntry } from "../lib/types";

interface Props {
  entries: TimelineEntry[];
}

function getMediaUrl(path: string) {
  const token = localStorage.getItem("wt_bearer");
  if (!token) return `/media/${path}`;
  return `/media/${path}?token=${encodeURIComponent(token)}`;
}

function MediaPreview({ type, path }: { type?: string; path: string }) {
  const url = useMemo(() => getMediaUrl(path), [path]);

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 4 }}>
        <img
          src={url}
          alt="WhatsApp Media"
          style={{ maxWidth: 200, maxHeight: 150, borderRadius: 4, display: "block" }}
        />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "inline-block", marginTop: 4 }}>
      View {type || "media"}
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
  url?: string;
}

type Block =
  | { type: "session"; session: Session }
  | { type: "offline-gap"; fromAt: number; toAt: number }
  | { type: "event"; ev: NonPresence };

export default function SessionTimeline({ entries }: Props) {
  if (!entries.length) {
    return <div className="muted">No events yet.</div>;
  }

  const messages = entries
    .filter((e) => e.kind === "message")
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);

  const statusEntries = entries.filter((e) => e.kind !== "message");
  const blocks = buildBlocks(statusEntries);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h4 style={{ margin: "0 0 8px", color: "var(--fg-muted, #888)" }}>Recent Messages</h4>
        {messages.length === 0 ? (
          <div className="muted">No messages yet.</div>
        ) : (
          <div className="session-timeline">
            {messages.map((e, i) => (
              <div key={i} className="session-event">
                <time className="session-time">{formatTime(e.at)}</time>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>
                    {e.isFromMe ? "Sent" : "Received"}:{" "}
                    <em style={{ fontStyle: "normal", color: "var(--fg)" }}>
                      {e.text || (e.mediaPath ? "" : <span className="muted">[{e.mediaType || "media"}]</span>)}
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
        <h4 style={{ margin: "0 0 8px", color: "var(--fg-muted, #888)" }}>Status</h4>
        {blocks.length === 0 ? (
          <div className="muted">No sessions recorded yet.</div>
        ) : (
          <div className="session-timeline">
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
  const start = formatTime(session.startAt);
  const end = session.endAt ? formatTime(session.endAt) : "now";
  const dur = session.durationSec != null ? formatDuration(session.durationSec) : null;
  const lastSeenDiff =
    session.lastSeen != null && session.endAt != null
      ? session.endAt - session.lastSeen
      : null;

  return (
    <div className="session-block session-online">
      <div className="session-header">
        <span className="session-dot session-dot-online" />
        <span className="session-label">
          Online {start} – {end}
          {dur ? <span className="session-duration">({dur})</span> : null}
        </span>
      </div>
      {lastSeenDiff != null && lastSeenDiff > 0 && (
        <div className="session-meta">
          Last activity {formatDuration(lastSeenDiff)} before going offline
        </div>
      )}
    </div>
  );
}

function GapBlock({ fromAt, toAt }: { fromAt: number; toAt: number }) {
  const dur = formatDuration(toAt - fromAt);
  return (
    <div className="session-block session-offline">
      <span className="session-dot session-dot-offline" />
      <span className="session-label session-muted">Offline {dur}</span>
    </div>
  );
}

function EventBlock({ ev }: { ev: NonPresence }) {
  return (
    <div className="session-event">
      <time className="session-time">{formatTime(ev.at)}</time>
      {ev.kind === "picture" ? (
        <span>
          Profile picture changed
          {ev.url ? (
            <> <a href={ev.url} target="_blank" rel="noreferrer">view</a></>
          ) : null}
        </span>
      ) : (
        <span>About updated: <em>{ev.text || "(empty)"}</em></span>
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
      url: e.url,
    }))
    .sort((a, b) => a.at - b.at);

  // Pair online→offline into sessions.
  const sessions: Session[] = [];
  let sessionStart: number | null = null;
  let sessionLastSeen: number | null = null;
  let lastOfflineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      sessionStart = p.at;
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
