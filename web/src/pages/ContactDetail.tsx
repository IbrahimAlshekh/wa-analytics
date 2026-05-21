import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AnalyticsRange, TimelineEntry } from "../lib/types";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import PresencePanel from "../components/PresencePanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import ContactAvatar from "../components/ContactAvatar";
import StoriesPanel from "../components/StoriesPanel";
import { useStore, wsKey } from "../lib/store";

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

type MainTab = "status" | "presence" | "stories" | "analytics";

const MAIN_TABS: { value: MainTab; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "presence", label: "Presence" },
  { value: "stories", label: "Stories" },
  { value: "analytics", label: "Analytics" },
];

export default function ContactDetail() {
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<MainTab>("status");
  const [range, setRange] = useState<AnalyticsRange>("week");

  const { upsertContact, removeContact, addWsEntry, pruneWsEntries, setLastPresence } = useStore();
  const contact = useStore((s) => s.contacts[cid]);
  const wsEntries = useStore((s) => s.wsEntries[wsKey(accountId, cid)]) ?? [];

  const toggleTracking = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateContact(accountId, cid, { trackingEnabled: enabled }),
    onSuccess: (updated) => {
      upsertContact(updated);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: () => api.deleteContact(accountId, cid),
    onSuccess: () => {
      removeContact(cid);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      navigate(`/accounts/${accountId}/contacts`);
    },
  });

  // Trigger a fresh profile-picture check whenever the contact page is opened.
  // The backend throttles this to once per 5 minutes per contact.
  useEffect(() => {
    api.refreshPicture(accountId, cid).catch(() => {});
  }, [accountId, cid]);

  const tl = useQuery({
    queryKey: ["timeline", accountId, cid],
    queryFn: () => api.timeline(accountId, cid, 0),
    refetchInterval: 30_000,
  });

  // Seed the store whenever the timeline query returns a (possibly updated) contact
  useEffect(() => {
    if (tl.data?.contact) upsertContact(tl.data.contact);
  }, [tl.data?.contact, upsertContact]);

  // Seed lastPresence from the timeline so the sidebar always has a value
  useEffect(() => {
    if (!tl.data?.entries) return;
    const latest = [...tl.data.entries]
      .filter((e) => e.kind === "presence" && e.state)
      .sort((a, b) => b.at - a.at)[0];
    if (latest?.state) setLastPresence(accountId, cid, latest.state, latest.at, latest.lastSeen);
  }, [tl.data?.entries, accountId, cid, setLastPresence]);

  // Prune WS entries that the server has now absorbed
  useEffect(() => {
    if (!tl.data) return;
    const serverKeys = new Set(
      (tl.data.entries ?? []).map((e) => `${e.kind}:${e.at}:${e.state ?? ""}`)
    );
    pruneWsEntries(accountId, cid, serverKeys);
  }, [tl.data, accountId, cid, pruneWsEntries]);

  // The global App.tsx WS handler already calls addWsEntry for every presence
  // event. We only need a local listener for events that arrive while this page
  // is mounted and App.tsx may have already fired — dedup is handled in the store.
  useEffect(() => {
    // Nothing extra needed: App.tsx calls addWsEntry globally.
    // This effect exists as documentation of the data-flow.
  }, [accountId, cid, addWsEntry]);

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

  if (tl.isLoading) return <div className="muted" style={{ padding: "48px 0", textAlign: "center" }}>Loading…</div>;
  if (tl.error) return <div className="error">{(tl.error as Error).message}</div>;
  if (!tl.data) return null;

  // Use store contact (most up-to-date) falling back to query data
  const c = contact ?? tl.data.contact;
  const displayName = c.displayName || c.phone;

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
        <ContactAvatar name={displayName} picturePath={c.latestPicturePath} size="lg" />
        <div className="contact-hero-info">
          <div className="contact-hero-name">{displayName}</div>
          <div className="contact-hero-phone">{c.phone}</div>
          <div className="row" style={{ gap: 6 }}>
            <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
              <span className={`dot ${isOnline ? "online" : ""}`} style={{ width: 6, height: 6 }} />
              {isOnline ? "Online now" : "Offline"}
            </span>
            <span className={`badge ${c.trackingEnabled ? "badge-tracking" : "badge-paused"}`}>
              {c.trackingEnabled ? "Tracking" : "Paused"}
            </span>
          </div>
        </div>
        <div className="contact-hero-actions">
          <Link to={`/accounts/${accountId}/contacts/${cid}/messages`} className="btn">
            Messages
          </Link>
          <button
            className="btn btn-ghost"
            disabled={toggleTracking.isPending}
            onClick={() => toggleTracking.mutate(!c.trackingEnabled)}
            title={c.trackingEnabled ? "Pause tracking" : "Resume tracking"}
          >
            {toggleTracking.isPending
              ? "…"
              : c.trackingEnabled
              ? "Pause tracking"
              : "Resume tracking"}
          </button>
          <button
            className="btn btn-danger"
            disabled={deleteContactMutation.isPending}
            onClick={() => {
              if (confirm(`Delete ${displayName}? This cannot be undone.`)) {
                deleteContactMutation.mutate();
              }
            }}
          >
            {deleteContactMutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Top-level tab bar */}
      <div className="tabs contact-main-tabs">
        {MAIN_TABS.map(({ value, label }) => (
          <button
            key={value}
            className="btn"
            aria-current={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Status */}
      {tab === "status" && (
        <>
          <LiveStatusCard
            entries={allEntries}
            isOnline={isOnline}
            sessionStart={sessionStart}
            lastPresence={lastPresence}
          />
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Activity Timeline</span>
            </div>
            <SessionTimeline entries={allEntries} />
          </div>
        </>
      )}

      {/* Tab: Presence */}
      {tab === "presence" && (
        <>
          <StatsStrip accountId={accountId} contactId={cid} />
          <PresencePanel entries={allEntries} contact={c} />
        </>
      )}

      {/* Tab: Stories */}
      {tab === "stories" && (
        <StoriesPanel accountId={accountId} contactId={cid} />
      )}

      {/* Tab: Analytics */}
      {tab === "analytics" && (
        <>
          <div className="card" style={{ padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
                Range
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
        </>
      )}
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
