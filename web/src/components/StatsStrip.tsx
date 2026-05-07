import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";

interface Props {
  accountId: number;
  contactId: number;
}

export default function StatsStrip({ accountId, contactId }: Props) {
  const [range, setRange] = useState<"today" | "week" | "month">("week");
  const stats = useQuery({
    queryKey: ["stats", accountId, contactId, range],
    queryFn: () => api.stats(accountId, contactId, range),
    refetchInterval: 60_000,
  });

  const data =
    stats.data?.days.map((d) => ({
      date: d.date.slice(5),
      minutes: Math.round(d.onlineSeconds / 60),
    })) ?? [];

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="tabs">
          {(["today", "week", "month"] as const).map((r) => (
            <button
              key={r}
              className="btn"
              aria-current={range === r}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="stats">
        <div className="stat-card">
          <div className="label">Online time</div>
          <div className="value">
            {formatDuration(stats.data?.onlineSecondsAll ?? 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Picture changes</div>
          <div className="value">{stats.data?.pictureChanges ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">About changes</div>
          <div className="value">{stats.data?.aboutChanges ?? 0}</div>
        </div>
      </div>
      <div className="card">
        <div className="muted" style={{ marginBottom: 8 }}>
          Online minutes per day
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.2)" />
              <XAxis dataKey="date" />
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

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return `${h}h ${m}m`;
}
