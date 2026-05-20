import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AnalyticsRange } from "../lib/types";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import PresencePanel from "../components/PresencePanel";
import AnalyticsPanel from "../components/AnalyticsPanel";

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

export default function ContactDetail() {
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const [range, setRange] = useState<AnalyticsRange>("week");

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

  if (tl.isLoading) return <div className="muted" style={{ padding: "48px 0", textAlign: "center" }}>Loading…</div>;
  if (tl.error) return <div className="error">{(tl.error as Error).message}</div>;
  if (!tl.data) return null;

  const { contact, entries } = tl.data;
  const displayName = contact.displayName || contact.phone;

  const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
  const isOnline = lastPresence?.state === "available";

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to={`/accounts/${accountId}`}>Contacts</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{displayName}</span>
      </div>

      {/* Contact hero */}
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
          <Link
            to={`/accounts/${accountId}/contacts/${cid}/messages`}
            className="btn"
          >
            Messages
          </Link>
        </div>
      </div>

      {/* Range tab strip */}
      <div className="card" style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Analytics
          </span>
          <div className="tabs">
            {RANGE_LABELS.map(({ value, label }) => (
              <button
                key={value}
                className="btn"
                aria-current={range === value}
                onClick={() => setRange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics panel */}
      {analyticsQ.data ? (
        <AnalyticsPanel report={analyticsQ.data} />
      ) : analyticsQ.isLoading ? (
        <div className="muted" style={{ textAlign: "center", padding: "16px 0" }}>Loading analytics…</div>
      ) : null}

      <StatsStrip accountId={accountId} contactId={cid} />

      <PresencePanel entries={entries} />

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <span className="section-label">Activity Timeline</span>
        </div>
        <SessionTimeline entries={entries} />
      </div>

    </div>
  );
}
