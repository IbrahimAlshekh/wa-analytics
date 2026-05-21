import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Contact, TimelineEntry } from "../lib/types";
import { getMediaUrl } from "../lib/media";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  entries: TimelineEntry[];
  contact?: Contact;
}

export default function PresencePanel({ entries, contact }: Props) {
  const safeEntries = entries ?? [];
  const hourlyData    = computePeakHours(safeEntries);
  const weekdayData   = computeWeekdayActivity(safeEntries);
  const trend30       = computeTrend30Days(safeEntries);
  const heatmapData   = computeHeatmap(safeEntries);

  const avgSession    = computeAvgSessionDuration(safeEntries);
  const longestSess   = computeLongestSession(safeEntries);
  const streak        = computeStreak(safeEntries);
  const { avgOnlineSec, trendPct } = computeDailyAvgOnline(safeEntries);
  const nightOwlPct   = computeNightOwlScore(safeEntries);
  const consistency   = computeConsistencyScore(safeEntries);
  const picFreqDays   = computePicChangeFrequency(safeEntries);
  const { firstSeen, lastSeen } = computeFirstLastSeen(safeEntries);
  const sleepWindow   = computeSleepWindow(safeEntries);
  const longestOffline = computeLongestOfflineStreak(safeEntries);

  const patternSummary = computeOnlinePatternSummary(hourlyData);

  const aboutHistory   = safeEntries.filter((e) => e.kind === "about").sort((a, b) => b.at - a.at);
  // Only show pictures stored locally — never serve from external WhatsApp CDN URLs
  const pictureHistory = safeEntries.filter((e) => e.kind === "picture" && e.mediaPath).sort((a, b) => b.at - a.at);

  const hasPresence = hourlyData.some((d) => d.minutes > 0);
  if (!hasPresence) return null;

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* ── Presence stat cards ── */}
      <div className="card" style={{ padding: "14px 16px" }}>
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center" }}>
            Presence
            <InfoTooltip text="These metrics are computed from WhatsApp presence events — when the contact appeared online or went offline. Accuracy depends on how long tracking has been active and whether WhatsApp presence visibility is enabled for this contact." />
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3, lineHeight: 1.45, opacity: 0.8 }}>
            Online activity summary based on tracked presence events.
          </div>
        </div>
        <div className="stats" style={{ marginBottom: 0 }}>
          {avgSession != null && (
            <StatCard
              label="Avg session"
              value={formatDuration(avgSession)}
              description="Average duration of a single online session."
              info="Short sessions (&lt;3 min) suggest quick message checks; longer sessions mean active browsing. Combined with peak hours, this reveals their daily phone habits."
            />
          )}
          {longestSess != null && (
            <StatCard
              label="Longest session"
              value={formatDuration(longestSess)}
              description="Single longest continuous time online."
              info="An unusually long session may indicate a video call, a busy work period, or a day spent on the phone. Compare it to the average to see how typical it was."
            />
          )}
          {avgOnlineSec != null && (
            <StatCard
              label="Daily avg online"
              value={formatDuration(avgOnlineSec) + (trendPct != null ? `  ${trendPct > 0 ? "▲" : "▼"}${Math.abs(trendPct)}%` : "")}
              description="Average online time per day. ▲▼ = change vs. prior week."
              info="Compare this to your own online time to gauge whether you're both active at similar intensities. A rising trend means they've been using WhatsApp more recently."
            />
          )}
          {streak != null && (
            <StatCard
              label={streak.online ? "Online streak" : "Offline for"}
              value={streak.online ? `${streak.days}d` : formatDuration(streak.seconds)}
              description={streak.online ? "Consecutive days seen online." : "Time since last seen online."}
              info={streak.online ? "A long active streak means they use WhatsApp consistently every day. Useful for knowing they're reliably reachable." : "They haven't appeared online since this time. This could mean the app is closed, presence is hidden, or they are inactive."}
            />
          )}
          {longestOffline != null && (
            <StatCard
              label="Longest offline"
              value={`${longestOffline}d`}
              description="Longest gap between any two active days."
              info="A long offline streak may mark a trip, illness, or a period off WhatsApp entirely. Comparing it to the tracking period shows whether this was unusual or routine."
            />
          )}
          {nightOwlPct != null && (
            <StatCard
              label="Night owl"
              value={`${nightOwlPct}%`}
              description="Share of online time between midnight and 5am."
              info="A high score (>20%) suggests late-night habits, shift work, or a different time zone. This is the best time to reach them if you want a faster reply late at night."
            />
          )}
          {consistency != null && (
            <StatCard
              label="Consistency"
              value={`${consistency}/100`}
              description="How predictable their online schedule is."
              info="High consistency (>70) means their schedule is very regular — you can reliably reach them at the same times each day. Low consistency (below 30) means their WhatsApp usage is sporadic and hard to predict."
            />
          )}
          {picFreqDays != null && (
            <StatCard
              label="Pic changes"
              value={`every ${picFreqDays}d`}
              description="Average days between profile picture changes."
              info="Frequent changes (every few days) signal someone socially active or going through life changes. Rare changes (>90 days) suggest a stable or more private persona."
            />
          )}
        </div>
      </div>

      {/* ── Info banners ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {patternSummary && (
          <div className="card" style={{ padding: "12px 16px" }}>
            <div className="muted" style={{ fontSize: 11, display: "flex", alignItems: "center" }}>
              Peak hours
              <InfoTooltip text="The best window to send a message and get a timely reply. If their peak hours don't overlap with yours, expect longer response gaps even when they're active." />
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, opacity: 0.7 }}>Hours with activity above 50% of their peak</div>
            <div style={{ marginTop: 6, fontWeight: 600, color: "var(--accent)" }}>{patternSummary}</div>
          </div>
        )}
        {sleepWindow && (
          <div className="card" style={{ padding: "12px 16px" }}>
            <div className="muted" style={{ fontSize: 11, display: "flex", alignItems: "center" }}>
              Sleep window (est.)
              <InfoTooltip text="Knowing their estimated sleep window helps you avoid sending messages at inappropriate hours and better understand their daily rhythm. Requires at least 3 recurring overnight offline gaps (≥3h, starting 8pm–4am) to compute." />
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, opacity: 0.7 }}>Estimated from recurring overnight offline gaps</div>
            <div style={{ marginTop: 6, fontWeight: 600 }}>{sleepWindow}</div>
          </div>
        )}
        {firstSeen && (
          <div className="card" style={{ padding: "12px 16px" }}>
            <div className="muted" style={{ fontSize: 11, display: "flex", alignItems: "center" }}>
              Tracking period
              <InfoTooltip text="Longer tracking periods produce more accurate patterns — at least 2 weeks is needed for reliable daily averages, and 4+ weeks for streak and sleep estimates. Short periods may not reflect long-term behavior." />
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, opacity: 0.7 }}>Date range of recorded presence events</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span>{formatDate(firstSeen)}</span>
              <span className="muted"> → </span>
              <span>{formatDate(lastSeen!)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Presence & Activity
          — hourly pattern, weekday pattern, heatmap, 30-day trend
      ══════════════════════════════════════════════════════════ */}
      <div className="col" style={{ gap: 12 }}>
        <div className="section-label">Presence &amp; Activity</div>

        {/* Hourly + Weekday patterns side-by-side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center" }}>
              Peak Activity Hours
              <InfoTooltip text="If their peak hours don't overlap with yours, most messages will sit unread for hours before a reply — which can feel like low engagement even when they're active. Use this to find the best time to reach them." />
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Total online minutes per hour of the day across all tracked days</div>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={hourlyData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--accent-dim)" }} />
                  <Bar dataKey="minutes" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center" }}>
              Most Active Days
              <InfoTooltip text="Weekend vs. weekday peaks reveal the nature of their WhatsApp usage. High weekend activity often signals personal, social use. High weekday activity may indicate professional use or habit. Weekends are shown in a different color." />
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Total online minutes per day of the week (weekends highlighted)</div>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={weekdayData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--accent-dim)" }} />
                  <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                    {weekdayData.map((d, i) => (
                      <Cell key={i} fill={d.weekend ? "var(--offline)" : "var(--accent)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Activity Heatmap — full width */}
        {heatmapData.length > 0 && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center" }}>
              Activity Heatmap
              <InfoTooltip text="Clusters of dark cells reveal sustained active periods. Gaps (light or empty weeks) can mark vacations, illness, or extended time off WhatsApp. Each cell is one day — darker green = more total online time." />
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Daily online time over the last 16 weeks — darker = more active</div>
            <Heatmap data={heatmapData} />
          </div>
        )}

        {/* 30-Day Trend — full width */}
        {trend30.length > 1 && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center" }}>
              30-Day Online Trend
              <InfoTooltip text="An upward trend means they've been more active on WhatsApp recently. A downward trend may mean they're busier, switched devices, or are spending less time on their phone. Sudden spikes often correspond to specific events." />
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Online minutes per day over the last 30 days</div>
            <div style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer>
                <LineChart data={trend30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="minutes" stroke="var(--accent)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Profile Picture History
      ══════════════════════════════════════════════════════════ */}
      <div className="col" style={{ gap: 12 }}>
        <div className="section-label">Profile Picture History</div>
        <div className="card">
          {pictureHistory.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>No profile pictures recorded yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
              {pictureHistory.map((e, i) => {
                const src = getMediaUrl(e.mediaPath!);
                return (
                  <a key={i} href={src} target="_blank" rel="noreferrer"
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none" }}>
                    <img
                      src={src}
                      alt={formatDatetime(e.at)}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        objectFit: "cover",
                        borderRadius: 10,
                        border: i === 0 ? "2px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? "var(--accent)" : "var(--fg)" }}>
                        {i === 0 ? "Latest" : `#${pictureHistory.length - i}`}
                      </div>
                      <div className="muted" style={{ fontSize: 10 }}>{formatDate(e.at)}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Status (About) History
      ══════════════════════════════════════════════════════════ */}
      <div className="col" style={{ gap: 12 }}>
        <div className="section-label">Status History</div>
        <div className="card">
          {aboutHistory.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>No status changes recorded yet.</div>
          ) : (
            <div className="col" style={{ gap: 0 }}>
              {aboutHistory.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "10px 0",
                    borderBottom: i < aboutHistory.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--accent)" : "var(--border)",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div className="col" style={{ gap: 2, flex: 1 }}>
                    <div style={{ fontSize: 13 }}>
                      {e.text ? e.text : <em className="muted" style={{ fontSize: 12 }}>(cleared)</em>}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>{formatDatetime(e.at)}</div>
                  </div>
                  {i === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", flexShrink: 0, paddingTop: 2 }}>
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Other Information
      ══════════════════════════════════════════════════════════ */}
      {contact && (
        <div className="col" style={{ gap: 12 }}>
          <div className="section-label">Other Information</div>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <InfoRow label="Phone" value={contact.phone} />
              <InfoRow label="JID" value={contact.jid} mono />
              <InfoRow label="Display Name" value={contact.displayName || "—"} />
              <InfoRow label="Tracking" value={contact.trackingEnabled ? "Active" : "Paused"} />
              <InfoRow label="Added" value={formatDatetime(contact.addedAt)} />
              {firstSeen && <InfoRow label="First seen" value={formatDatetime(firstSeen)} />}
              {lastSeen && <InfoRow label="Last seen" value={formatDatetime(lastSeen)} />}
              {pictureHistory.length > 0 && (
                <InfoRow label="Picture changes" value={`${pictureHistory.length} recorded`} />
              )}
              {aboutHistory.length > 0 && (
                <InfoRow label="Status changes" value={`${aboutHistory.length} recorded`} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Export ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" onClick={() => exportCSV(safeEntries)}>Export CSV</button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
      <div className="muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, description, info }: { label: string; value: string; description?: string; info?: string }) {
  return (
    <div className="stat-card">
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 2 }}>
        <div className="label" style={{ display: "flex", alignItems: "center" }}>
          {label}
          {info && <InfoTooltip text={info} />}
        </div>
        {description && (
          <div style={{ fontSize: 9, color: "var(--fg-muted)", lineHeight: 1.35, opacity: 0.75 }}>
            {description}
          </div>
        )}
      </div>
      <div className="value" style={{ fontSize: "1.1rem" }}>{value}</div>
    </div>
  );
}

function Heatmap({ data }: { data: { date: string; minutes: number }[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Group by week — each week is a column (Mon start)
  const weeks: { date: string; minutes: number; dow: number }[][] = [];
  let week: { date: string; minutes: number; dow: number }[] = [];

  for (const d of data) {
    const dow = new Date(d.date + "T00:00:00").getDay(); // 0=Sun
    const monDow = dow === 0 ? 6 : dow - 1;             // 0=Mon
    if (week.length === 0 && monDow !== 0) {
      for (let i = 0; i < monDow; i++) week.push({ date: "", minutes: -1, dow: i });
    }
    week.push({ ...d, dow: monDow });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push(week);

  const maxMin = Math.max(...data.map((d) => d.minutes), 1);
  const cellColor = (min: number) => {
    if (min < 0) return "transparent";
    if (min === 0) return "var(--border)";
    const intensity = Math.min(min / maxMin, 1);
    return `rgba(22,163,74,${0.15 + intensity * 0.85})`;
  };

  // Month label: show on the first week column whose earliest date is in the first 7 days of a month
  const monthLabels = weeks.map((w) => {
    const first = w.find((c) => c.date);
    if (!first) return "";
    const d = new Date(first.date + "T00:00:00");
    return d.getDate() <= 7
      ? d.toLocaleString("default", { month: "short" })
      : "";
  });

  const CELL_H = 14;
  const GAP    = 3;
  const DAY_LABELS = ["M", "", "W", "", "F", "", "S"];

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Month labels */}
      <div style={{ display: "flex", marginBottom: 6, paddingLeft: 18 }}>
        {weeks.map((_, wi) => (
          <div
            key={wi}
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 600,
              color: "var(--fg-muted)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {monthLabels[wi]}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "flex", gap: GAP, alignItems: "flex-start", width: "100%" }}>
        {/* Day-of-week labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: GAP, flexShrink: 0, width: 14 }}>
          {DAY_LABELS.map((l, i) => (
            <div
              key={i}
              style={{
                height: CELL_H,
                fontSize: 9,
                lineHeight: `${CELL_H}px`,
                color: "var(--fg-muted)",
                textAlign: "right",
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Week columns — flex:1 stretches to fill full width */}
        {weeks.map((w, wi) => (
          <div key={wi} style={{ flex: 1, display: "flex", flexDirection: "column", gap: GAP }}>
            {Array.from({ length: 7 }, (_, di) => {
              const cell = w[di];
              return (
                <div
                  key={di}
                  style={{
                    height: CELL_H,
                    borderRadius: 3,
                    backgroundColor: cell ? cellColor(cell.minutes) : "transparent",
                    cursor: cell && cell.date ? "default" : undefined,
                  }}
                  onMouseEnter={cell && cell.date ? (e) => {
                    const r = (e.target as HTMLElement).getBoundingClientRect();
                    setTooltip({ text: `${cell.date}: ${cell.minutes}m`, x: r.left, y: r.top - 28 });
                  } : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x, top: tooltip.y,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 4, padding: "2px 8px", fontSize: 11, pointerEvents: "none", zIndex: 999,
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Computations

function computePeakHours(entries: TimelineEntry[]) {
  const buckets = new Array(24).fill(0);
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) { distributeToHours(buckets, onlineAt, p.at); onlineAt = null; }
  }
  if (onlineAt != null) distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
  return buckets.map((sec, i) => ({ hour: i.toString().padStart(2, "0"), minutes: Math.round(sec / 60) }));
}

function distributeToHours(buckets: number[], start: number, end: number) {
  let cur = start;
  while (cur < end) {
    const hour = new Date(cur * 1000).getHours();
    const next = Math.floor(cur / 3600) * 3600 + 3600;
    const sliceEnd = Math.min(end, next);
    buckets[hour] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeWeekdayActivity(entries: TimelineEntry[]) {
  const buckets = new Array(7).fill(0);
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) { distributeToWeekdays(buckets, onlineAt, p.at); onlineAt = null; }
  }
  if (onlineAt != null) distributeToWeekdays(buckets, onlineAt, Math.floor(Date.now() / 1000));
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({
    day: WEEKDAYS[i],
    minutes: Math.round(buckets[i] / 60),
    weekend: i === 0 || i === 6,
  }));
}

function distributeToWeekdays(buckets: number[], start: number, end: number) {
  let cur = start;
  while (cur < end) {
    const d = new Date(cur * 1000);
    const dow = d.getDay();
    const next = new Date(d); next.setHours(24, 0, 0, 0);
    const sliceEnd = Math.min(end, Math.floor(next.getTime() / 1000));
    buckets[dow] += sliceEnd - cur;
    cur = sliceEnd;
  }
}

function computeAvgSessionDuration(entries: TimelineEntry[]): number | null {
  const { durations } = parseSessions(entries);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function computeLongestSession(entries: TimelineEntry[]): number | null {
  const { durations } = parseSessions(entries);
  if (durations.length === 0) return null;
  return Math.max(...durations);
}

function parseSessions(entries: TimelineEntry[]): { durations: number[] } {
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  const durations: number[] = [];
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) {
      durations.push(p.at - onlineAt); onlineAt = null;
    }
  }
  return { durations };
}

function computeStreak(entries: TimelineEntry[]): { online: boolean; days: number; seconds: number } | null {
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;
  const last = presence[presence.length - 1];
  if (last.state === "unavailable") {
    return { online: false, days: 0, seconds: Math.floor(Date.now() / 1000) - last.at };
  }
  const activeDays = new Set<string>();
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) {
      activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10)); onlineAt = null;
    }
  }
  let streak = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (activeDays.has(d.toISOString().slice(0, 10))) streak++; else break;
  }
  return { online: true, days: streak, seconds: 0 };
}

function computeLongestOfflineStreak(entries: TimelineEntry[]): number | null {
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;
  // Build set of active days
  const activeDays = new Set<string>();
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) {
      activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10)); onlineAt = null;
    }
  }
  if (activeDays.size === 0) return null;
  const sorted = [...activeDays].sort();
  const start = new Date(sorted[0] + "T00:00:00");
  const end   = new Date(sorted[sorted.length - 1] + "T00:00:00");
  let maxGap = 0, gap = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (activeDays.has(key)) { maxGap = Math.max(maxGap, gap); gap = 0; }
    else gap++;
  }
  return maxGap > 0 ? maxGap : null;
}

function computeDailyAvgOnline(entries: TimelineEntry[]): { avgOnlineSec: number | null; trendPct: number | null } {
  const byDay = buildDailySeconds(entries);
  const days = Object.values(byDay);
  if (days.length === 0) return { avgOnlineSec: null, trendPct: null };
  const avgOnlineSec = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  const sorted = Object.keys(byDay).sort();
  let trendPct: number | null = null;
  if (sorted.length >= 14) {
    const recent = sorted.slice(-7).reduce((s, d) => s + byDay[d], 0) / 7;
    const prev   = sorted.slice(-14, -7).reduce((s, d) => s + byDay[d], 0) / 7;
    if (prev > 0) trendPct = Math.round(((recent - prev) / prev) * 100);
  }
  return { avgOnlineSec, trendPct };
}

function buildDailySeconds(entries: TimelineEntry[]): Record<string, number> {
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  const byDay: Record<string, number> = {};
  let onlineAt: number | null = null;
  const add = (start: number, end: number) => {
    let cur = start;
    while (cur < end) {
      const date = new Date(cur * 1000).toISOString().slice(0, 10);
      const d = new Date(cur * 1000); d.setHours(24, 0, 0, 0);
      const sliceEnd = Math.min(end, Math.floor(d.getTime() / 1000));
      byDay[date] = (byDay[date] ?? 0) + (sliceEnd - cur);
      cur = sliceEnd;
    }
  };
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) { add(onlineAt, p.at); onlineAt = null; }
  }
  if (onlineAt != null) add(onlineAt, Math.floor(Date.now() / 1000));
  return byDay;
}

function computeNightOwlScore(entries: TimelineEntry[]): number | null {
  const buckets = new Array(24).fill(0);
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  let onlineAt: number | null = null;
  for (const p of presence) {
    if (p.state === "available") { onlineAt = p.at; }
    else if (p.state === "unavailable" && onlineAt != null) { distributeToHours(buckets, onlineAt, p.at); onlineAt = null; }
  }
  if (onlineAt != null) distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const nightTime = buckets.slice(0, 5).reduce((a, b) => a + b, 0); // midnight–5am
  return Math.round((nightTime / total) * 100);
}

function computeConsistencyScore(entries: TimelineEntry[]): number | null {
  const byDay = buildDailySeconds(entries);
  const vals = Object.values(byDay);
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return null;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  const cv = std / mean; // 0 = perfectly consistent, higher = erratic
  return Math.max(0, Math.round(100 - cv * 100));
}

function computePicChangeFrequency(entries: TimelineEntry[]): number | null {
  const pics = entries.filter((e) => e.kind === "picture").sort((a, b) => a.at - b.at);
  if (pics.length < 2) return null;
  const span = (pics[pics.length - 1].at - pics[0].at) / 86400;
  return Math.round(span / (pics.length - 1));
}

function computeFirstLastSeen(entries: TimelineEntry[]): { firstSeen: number | null; lastSeen: number | null } {
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  if (presence.length === 0) return { firstSeen: null, lastSeen: null };
  return { firstSeen: presence[0].at, lastSeen: presence[presence.length - 1].at };
}

function computeSleepWindow(entries: TimelineEntry[]): string | null {
  // For each day find the longest offline gap. Average the start-hour of those gaps.
  const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
  if (presence.length === 0) return null;

  // Build offline gaps
  const gaps: { start: number; end: number }[] = [];
  for (let i = 1; i < presence.length; i++) {
    if (presence[i - 1].state === "unavailable" && presence[i].state === "available") {
      gaps.push({ start: presence[i - 1].at, end: presence[i].at });
    }
  }

  // Filter to gaps > 3h that span through night hours (8pm–10am)
  const nightGaps = gaps.filter((g) => {
    const dur = g.end - g.start;
    if (dur < 3 * 3600) return false;
    const startH = new Date(g.start * 1000).getHours();
    // Starts in evening or night: 20-24 or 0-4
    return startH >= 20 || startH <= 4;
  });

  if (nightGaps.length < 3) return null;

  // Circular mean of start hours and end hours
  const toRad = (h: number, m: number) => ((h + m / 60) / 24) * 2 * Math.PI;
  const circMean = (angles: number[]) => {
    const sx = angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length;
    const cx = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length;
    const r = Math.atan2(sx, cx);
    return ((r < 0 ? r + 2 * Math.PI : r) / (2 * Math.PI)) * 24;
  };

  const startAngles = nightGaps.map((g) => {
    const d = new Date(g.start * 1000);
    return toRad(d.getHours(), d.getMinutes());
  });
  const endAngles = nightGaps.map((g) => {
    const d = new Date(g.end * 1000);
    return toRad(d.getHours(), d.getMinutes());
  });

  const avgStart = circMean(startAngles);
  const avgEnd   = circMean(endAngles);

  const fmt = (h: number) => {
    const hr = Math.floor(h) % 24;
    const suffix = hr < 12 ? "am" : "pm";
    return `${hr % 12 === 0 ? 12 : hr % 12}${suffix}`;
  };
  return `${fmt(avgStart)} – ${fmt(avgEnd)}`;
}

function computeOnlinePatternSummary(hourlyData: { hour: string; minutes: number }[]): string | null {
  const threshold = Math.max(...hourlyData.map((d) => d.minutes)) * 0.5;
  if (threshold === 0) return null;
  const active = hourlyData.map((d, i) => ({ i, m: d.minutes })).filter((d) => d.m >= threshold).map((d) => d.i);
  if (active.length === 0) return null;
  const fmt = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
  return `${fmt(active[0])} – ${fmt(active[active.length - 1])}`;
}

function computeTrend30Days(entries: TimelineEntry[]) {
  const byDay = buildDailySeconds(entries);
  const result: { date: string; minutes: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key.slice(5), minutes: Math.round((byDay[key] ?? 0) / 60) });
  }
  return result;
}

function computeHeatmap(entries: TimelineEntry[]) {
  const byDay = buildDailySeconds(entries);
  const result: { date: string; minutes: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 111; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, minutes: Math.round((byDay[key] ?? 0) / 60) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Export

function exportCSV(entries: TimelineEntry[]) {
  const header = "timestamp,datetime,type,state,text,isFromMe,mediaType,url";
  const rows = entries
    .sort((a, b) => a.at - b.at)
    .map((e) => [
      e.at,
      new Date(e.at * 1000).toISOString(),
      e.kind,
      e.state ?? "",
      JSON.stringify(e.text ?? ""),
      e.isFromMe ?? "",
      e.mediaType ?? "",
      e.url ?? "",
    ].join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "contact-timeline.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Helpers

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDatetime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
