import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Timeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";

export default function ContactDetail() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const tl = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.timeline(id, 0),
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
          <Link to="/" className="muted">
            ← back
          </Link>
          <h2 style={{ margin: "4px 0 0" }}>
            {contact.displayName || contact.phone}
          </h2>
          <span className="muted">{contact.phone}</span>
        </div>
        <span className="tag">{contact.trackingEnabled ? "Tracking" : "Paused"}</span>
      </div>

      <StatsStrip contactId={id} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Timeline</h3>
        <Timeline entries={entries} />
      </div>
    </div>
  );
}
