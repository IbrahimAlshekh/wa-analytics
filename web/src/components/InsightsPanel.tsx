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

  if (!hourlyData.some((d) => d.minutes > 0)) {
    return null;
  }

  return (
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
    // Seconds remaining in this clock-hour
    const nextHourBoundary = Math.floor(cur / 3600) * 3600 + 3600;
    const sliceEnd = Math.min(end, nextHourBoundary);
    buckets[hour] += sliceEnd - cur;
    cur = sliceEnd;
  }
}
