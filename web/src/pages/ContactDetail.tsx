import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AnalyticsRange, TimelineEntry } from "../lib/types";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import PresencePanel from "../components/PresencePanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import { ws } from "../lib/ws";

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const RANGE_LABELS: { value: AnalyticsRange; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "all", label: "General" },
];

function formatRelative(unix: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

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
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function formatElapsed(startAt: number): string {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - startAt));
  if (elapsed < 60) return `${elapsed}s`;
  const m = Math.floor(elapsed / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

export default function ContactDetail() {
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const [range, setRange] = useState<AnalyticsRange>("week");
  const [wsEntries, setWsEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    return ws.on((msg) => {
      if (msg.type !== "presence") return;
      if (msg.accountId !== accountId || msg.contactId !== cid) return;
      const entry: TimelineEntry = {
        kind: "presence",
        at: msg.observedAt,
        state: msg.state,
        lastSeen: msg.lastSeen,
      };
      setWsEntries((prev) => {
        const key = `${entry.kind}:${entry.at}:${entry.state}`;
        if (prev.some((e) => `${e.kind}:${e.at}:${e.state}` === key)) return prev;
        return [...prev, entry];
      });
    });
  }, [accountId, cid]);

  const tl = useQuery({
    queryKey: ["timeline", accountId, cid],
    queryFn: () => api.timeline(accountId, cid, 0),
    refetchInterval: 30_000,
  });

  const analyticsQ = useQuery({
    queryKey: ["analytics", accountId, cid, range],
    queryFn: () => api.analytics(accountId, cid, range),
    staleTime: 60_000,
  });

  // Merge server + WS entries, dedup by kind:at:state
  const allEntries = useMemo<TimelineEntry[]>(() => {
    const base = tl.data?.entries ?? [];
    const seen = new Set<string>();
    const merged: TimelineEntry[] = [];
    for (const e of base) {
      const key = `${e.kind}:${e.at}:${e.state ?? ""}`;
      if (!seen.has(key)) { seen.add(key); merged.push(e); }
    }
    for (const e of wsEntries) {
      const key = `${e.kind}:${e.at}:${e.state ?? ""}`;
      if (!seen.has(key)) { seen.add(key); merged.push(e); }
    }
    return merged;
  }, [tl.data?.entries, wsEntries]);

  // After server refetch absorbs WS entries, drop them from local state
  useEffect(() => {
    if (!tl.data) return;
    const serverKeys = new Set(
      (tl.data.entries ?? []).map((e) => `${e.kind}:${e.at}:${e.state ?? ""}`)
    );
    setWsEntries((prev) => prev.filter((e) => !serverKeys.has(`${e.kind}:${e.at}:${e.state ?? ""}`)));
  }, [tl.data]);

  if (tl.isLoading) return <div className="muted" style={{ padding: "48px 0", textAlign: "center" }}>Loading…</div>;
  if (tl.error) return <div className="error">{(tl.error as Error).message}</div>;
  if (!tl.data) return null;

  const contact = tl.data.contact;
  const displayName = contact.displayName || contact.phone;

  const presenceEntries = allEntries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);
  const lastPresence = presenceEntries[presenceEntries.length - 1];
  const isOnline = lastPresence?.state === "available";

  // Find start of the current session (earliest contiguous "available" from the end)
  let sessionStart: number | null = null;
  if (isOnline) {
    for (let i = presenceEntries.length - 1; i >= 0; i--) {
      if (presenceEntries[i].state === "available") {
        sessionStart = presenceEntries[i].at;
      } else {
        break;
      }
    }
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Hero */}
      <div className="contact-hero">
        <div className="avatar avatar-lg">{getInitials(displayName)}</div>
        <div className="contact-hero-info">
          <div className="contact-hero-name">{displayName}</div>
          <div className="contact-hero-phone">{contact.phone}</div>
          <div className="row" style={{ gap: 6 }}>
            <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
              <span className={`dot ${isOnline ? "online" : ""}`} style={{ width: 6, height: 6 }} />
              {isOnline ? "Online now" : "Offline"}
            </span>
            <span className={`badge ${contact.trackingEnabled ? "badge-tracking" : "badge-paused"}`}>
              {contact.trackingEnabled ? "Tracking" : "Paused"}
            </span>
          </div>
        </div>
        <div className="contact-hero-actions">
          <Link to={`/accounts/${accountId}/contacts/${cid}/messages`} className="btn">
            Messages
          </Link>
        </div>
      </div>

      {/* Live Status — first thing after hero */}
      <LiveStatusCard
        entries={allEntries}
        isOnline={isOnline}
        sessionStart={sessionStart}
        lastPresence={lastPresence}
      />

      <StatsStrip accountId={accountId} contactId={cid} />

      {/* Analytics */}
      <div className="card" style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Analytics
          </span>
          <div className="tabs">
            {RANGE_LABELS.map(({ value, label }) => (
              <button key={value} className="btn" aria-current={range === value} onClick={() => setRange(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {analyticsQ.data ? (
        <AnalyticsPanel report={analyticsQ.data} />
      ) : analyticsQ.isLoading ? (
        <div className="muted" style={{ textAlign: "center", padding: "16px 0" }}>Loading analytics…</div>
      ) : null}

      <PresencePanel entries={allEntries} />

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <span className="section-label">Activity Timeline</span>
        </div>
        <SessionTimeline entries={allEntries} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Session {
  startAt: number;
  endAt: number | null;
  durationSec: number | null;
}

function buildRecentSessions(entries: TimelineEntry[]): Session[] {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  const sessions: Session[] = [];
  let start: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      if (start === null) start = p.at;
    } else if (p.state === "unavailable" && start != null) {
      sessions.push({ startAt: start, endAt: p.at, durationSec: p.at - start });
      start = null;
    }
  }
  if (start != null) {
    sessions.push({ startAt: start, endAt: null, durationSec: null });
  }

  // Merge sessions with gap < 120s (same as Timeline.tsx)
  const merged: Session[] = [];
  for (const s of sessions) {
    const prev = merged[merged.length - 1];
    if (prev && prev.endAt != null && s.startAt - prev.endAt <= 120) {
      prev.endAt = s.endAt;
      prev.durationSec = prev.endAt != null ? prev.endAt - prev.startAt : null;
    } else {
      merged.push({ ...s });
    }
  }

  // Last 8, newest first
  return merged.slice(-8).reverse();
}

function LiveStatusCard({
  entries,
  isOnline,
  sessionStart,
  lastPresence,
}: {
  entries: TimelineEntry[];
  isOnline: boolean;
  sessionStart: number | null;
  lastPresence: TimelineEntry | undefined;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOnline]);

  const recentSessions = useMemo(() => buildRecentSessions(entries), [entries]);

  const lastSeenText = !isOnline && lastPresence
    ? lastPresence.lastSeen
      ? `last seen ${formatRelative(lastPresence.lastSeen)}`
      : `last seen ${formatRelative(lastPresence.at)}`
    : null;

  const elapsed = isOnline && sessionStart != null ? formatElapsed(sessionStart) : null;

  return (
    <div className={`card live-status-card${isOnline ? " live-status-online" : " live-status-offline"}`}>
      <div className="live-status-main">
        <div className="live-status-indicator">
          <span
            className={`dot${isOnline ? " online" : ""}`}
            style={{ width: 14, height: 14, flexShrink: 0 }}
          />
          <div>
            <div className="live-status-label">{isOnline ? "Online" : "Offline"}</div>
            {elapsed && <div className="live-status-sub">for {elapsed}</div>}
            {lastSeenText && <div className="live-status-sub">{lastSeenText}</div>}
          </div>
        </div>
        {isOnline && sessionStart != null && (
          <div className="live-status-since">since {formatTime(sessionStart)}</div>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div className="live-status-sessions">
          <div className="live-status-sessions-label">Recent sessions</div>
          {recentSessions.map((s, i) => (
            <div key={i} className="live-status-session-row">
              <span
                className="dot"
                style={{
                  width: 6,
                  height: 6,
                  flexShrink: 0,
                  background: s.endAt == null ? "var(--accent)" : "var(--offline)",
                }}
              />
              <span className="live-session-time">
                {formatTime(s.startAt)}
                {s.endAt ? ` – ${formatTime(s.endAt)}` : " – now"}
              </span>
              {s.durationSec != null && (
                <span className="live-session-dur">{formatDuration(s.durationSec)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
