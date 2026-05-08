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
    <div className="col" style={{ gap: 12 }}>
      {/* Range tabs + stat cards row */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 420px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Online time
            </span>
            <div className="tabs">
              {(["today", "week", "month"] as const).map((r) => (
                <button
                  key={r}
                  className="btn"
                  aria-current={range === r}
                  onClick={() => setRange(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="stat-card">
              <div className="label">Online time</div>
              <div className="value">{formatDuration(stats.data?.onlineSecondsAll ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Pic changes</div>
              <div className="value">{stats.data?.pictureChanges ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">About changes</div>
              <div className="value">{stats.data?.aboutChanges ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500, marginBottom: 12 }}>
          Online minutes per day
        </div>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "var(--accent-dim)" }}
              />
              <Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} />
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
