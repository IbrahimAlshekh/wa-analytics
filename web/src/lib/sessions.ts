import type { TimelineEntry } from "@/types/timeline";
import type { Session, NonPresence, Block } from "@/types/session";

export type { Session, NonPresence, Block };

export const MERGE_GAP_SEC = 120;

export function buildBlocks(entries: TimelineEntry[]): Block[] {
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

  const sessions: Session[] = [];
  let sessionStart: number | null = null;
  let sessionLastSeen: number | null = null;
  let lastOfflineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
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
      lastOfflineAt = p.at;
    }
  }
  if (sessionStart != null) {
    sessions.push({
      startAt: sessionStart,
      endAt: null,
      lastSeen: sessionLastSeen,
      durationSec: null,
    });
    lastOfflineAt = null;
  }

  // Merge sessions whose gap is under MERGE_GAP_SEC.
  const merged: Session[] = [];
  for (const s of sessions) {
    const prev = merged[merged.length - 1];
    if (prev && prev.endAt != null && s.startAt - prev.endAt <= MERGE_GAP_SEC) {
      prev.endAt = s.endAt;
      prev.durationSec = prev.endAt != null ? prev.endAt - prev.startAt : null;
      prev.lastSeen = s.lastSeen ?? prev.lastSeen;
    } else {
      merged.push({ ...s });
    }
  }

  const blocks: Block[] = [];
  for (let i = 0; i < merged.length; i++) {
    const prev = merged[i - 1];
    const cur = merged[i];
    if (prev && prev.endAt != null) {
      const gapSec = cur.startAt - prev.endAt;
      if (gapSec > 30) {
        blocks.push({
          type: "offline-gap",
          fromAt: prev.endAt,
          toAt: cur.startAt,
        });
      }
    }
    blocks.push({ type: "session", session: cur });
  }

  // Interleave non-presence events.
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

  const reversed = mixed.reverse();

  if (lastOfflineAt != null) {
    const offlineSince = Math.floor(Date.now() / 1000 - lastOfflineAt);
    const offlineBlock: Block = {
      type: "offline-gap",
      fromAt: lastOfflineAt,
      toAt: Math.floor(Date.now() / 1000),
    };
    if (offlineSince > 30) {
      return [offlineBlock, ...reversed];
    }
  }

  return reversed;
}

export function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Day grouping for PresenceLog -------------------------------------------

export interface DayGroup {
  isoDate: string; // "YYYY-MM-DD"
  blocks: Block[];
}

function blockTimestamp(b: Block): number {
  if (b.type === "session") return b.session.startAt;
  if (b.type === "offline-gap") return b.fromAt;
  return b.ev.at;
}

function toISODate(unix: number): string {
  const d = new Date(unix * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group blocks by calendar day, most-recent day first. */
export function groupBlocksByDay(blocks: Block[]): DayGroup[] {
  const map = new Map<string, Block[]>();
  for (const b of blocks) {
    const key = toISODate(blockTimestamp(b));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([isoDate, blocks]) => ({ isoDate, blocks }));
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
