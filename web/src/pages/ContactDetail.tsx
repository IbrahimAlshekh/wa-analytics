import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import InsightsPanel from "../components/InsightsPanel";

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ContactDetail() {
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const tl = useQuery({
    queryKey: ["timeline", accountId, cid],
    queryFn: () => api.timeline(accountId, cid, 0),
    refetchInterval: 30_000,
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

      <StatsStrip accountId={accountId} contactId={cid} />

      <InsightsPanel entries={entries} />

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <span className="section-label">Activity Timeline</span>
        </div>
        <SessionTimeline entries={entries} />
      </div>

    </div>
  );
}
