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
  const weekdayData = computeWeekdayActivity(entries);
  const avgSession = computeAvgSessionDuration(entries);
  const avgResponseTime = computeAvgResponseTime(entries);

  const hasPresence = hourlyData.some((d) => d.minutes > 0);

  if (!hasPresence) {
    return null;
  }

  const statCards = [
    avgSession != null && { label: "Avg session duration", value: formatDuration(avgSession) },
    avgResponseTime != null && { label: "Avg response time", value: formatDuration(avgResponseTime) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="col" style={{ gap: 16 }}>
      {statCards.length > 0 && (
        <div className="stats">
          {statCards.map((c) => (
            <div key={c.label} className="stat-card">
              <div className="label">{c.label}</div>
              <div className="value">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Peak Activity Hours</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Online minutes by hour of day
          </div>
          <div style={{ width: "100%", height: 200 }}>
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

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Most Active Days</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Online minutes by day of week
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={weekdayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="minutes" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeWeekdayActivity(entries: TimelineEntry[]) {
  const buckets = new Array(7).fill(0); // seconds per weekday index

  const presence = entries
    .filter((e) => e.kind === "presence")
    .sort((a, b) => a.at - b.at);

  let onlineAt: number | null = null;

  for (const p of presence) {
    if (p.state === "available") {
      onlineAt = p.at;
    } else if (p.state === "unavailable" && onlineAt != null) {
      distributeToWeekdays(buckets, onlineAt, p.at);
      onlineAt = null;
    }
  }
  if (onlineAt != null) {
    distributeToWeekdays(buckets, onlineAt, Math.floor(Date.now() / 1000));
  }

  // Reorder so Monday is first (index 1 → 6, then 0)
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((i) => ({
    day: WEEKDAYS[i],
    minutes: Math.round(buckets[i] / 60),
  }));
}

function distributeToWeekdays(buckets: number[], start: number, end: number) {
  let cur = start;
  while (cur < end) {
    const d = new Date(cur * 1000);
    const dow = d.getDay();
    // Next midnight boundary
    const next = new Date(d);
    next.setHours(24, 0, 0, 0);
    const nextBoundary = Math.floor(next.getTime() / 1000);
    const sliceEnd = Math.min(end, nextBoundary);
    buckets[dow] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

// Returns average time (seconds) between receiving a message and the next sent reply.
function computeAvgResponseTime(entries: TimelineEntry[]): number | null {
  const messages = entries
    .filter((e) => e.kind === "message")
    .sort((a, b) => a.at - b.at);

  const gaps: number[] = [];
  let lastReceivedAt: number | null = null;

  for (const m of messages) {
    if (!m.isFromMe) {
      lastReceivedAt = m.at;
    } else if (m.isFromMe && lastReceivedAt != null) {
      const gap = m.at - lastReceivedAt;
      // Only count gaps under 24h — larger gaps are likely not replies
      if (gap > 0 && gap < 86400) {
        gaps.push(gap);
      }
      lastReceivedAt = null;
    }
  }

  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
