import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelineEntry } from "../lib/types";

interface Props {
  entries: TimelineEntry[];
}

export default function InsightsPanel({ entries }: Props) {
  const hourlyData = computePeakHours(entries);
  const avgSession = computeAvgSessionDuration(entries);

  const hasPresence = hourlyData.some((d) => d.minutes > 0);

  if (!hasPresence) {
    return null;
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {avgSession != null && (
        <div className="stats">
          <div className="stat-card">
            <div className="label">Avg session duration</div>
            <div className="value">{formatDuration(avgSession)}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Peak Activity Hours</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Online minutes by hour of day
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="minutes" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function computePeakHours(entries: TimelineEntry[]) {
  const buckets = new Array(24).fill(0); // seconds per hour

  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  let onlineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      distributeToHours(buckets, onlineAt, p.at);
      onlineAt = null;
    }
  }
  // If still online, count up to now
  if (onlineAt != null) {
    distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
  }

  return buckets.map((sec, i) => ({
    hour: `${i.toString().padStart(2, "0")}`,
    minutes: Math.round(sec / 60),
  }));
}

function distributeToHours(buckets: number[], start: number, end: number) {
  let cur = start;
  while (cur < end) {
    const d = new Date(cur * 1000);
    const hour = d.getHours();
    const nextHourBoundary = Math.floor(cur / 3600) * 3600 + 3600;
    const sliceEnd = Math.min(end, nextHourBoundary);
    buckets[hour] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

// Returns average session duration in seconds, or null if no complete sessions.
function computeAvgSessionDuration(entries: TimelineEntry[]): number | null {
  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  const durations: number[] = [];
  let onlineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      durations.push(p.at - onlineAt);
      onlineAt = null;
    }
  }

  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
