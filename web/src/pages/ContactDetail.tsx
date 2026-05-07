import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import InsightsPanel from "../components/InsightsPanel";

export default function ContactDetail() {
  const { id: accountIdStr, cid: cidStr } = useParams<{ id: string; cid: string }>();
  const accountId = Number(accountIdStr);
  const cid = Number(cidStr);

  const tl = useQuery({
    queryKey: ["timeline", accountId, cid],
    queryFn: () => api.timeline(accountId, cid, 0),
    refetchInterval: 30_000,
  });

  if (tl.isLoading) return <div className="muted">Loading…</div>;
  if (tl.error)
    return <div className="error">{(tl.error as Error).message}</div>;
  if (!tl.data) return null;

  const { contact, entries } = tl.data;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <Link to={`/accounts/${accountId}`} className="muted">
            ← back
          </Link>
          <h2 style={{ margin: "4px 0 0" }}>
            {contact.displayName || contact.phone}
          </h2>
          <span className="muted">{contact.phone}</span>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <span className="tag">{contact.trackingEnabled ? "Tracking" : "Paused"}</span>
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
        <h3 style={{ marginTop: 0 }}>Activity timeline</h3>
        <SessionTimeline entries={entries} />
      </div>
    </div>
  );
}
