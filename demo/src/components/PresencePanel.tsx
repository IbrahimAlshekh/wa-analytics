import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { Contact, TimelineEntry } from "../lib/types";
import { getMediaUrl } from "../lib/media";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  entries: TimelineEntry[];
  contact?: Contact;
}

export default function PresencePanel({ entries, contact }: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
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
    <div className="flex flex-col gap-5">

      {/* ── Presence stat cards ── */}
      <Card>
        <CardContent className="pt-4">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              {t("presence.sectionTitle")}
              <InfoIcon text={t("presence.sectionTooltip")} />
            </p>
            <div className="text-xs text-muted-foreground mt-0.5 leading-snug opacity-80">
              {t("presence.sectionDesc")}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {avgSession != null && (
              <StatCard
                label={t("presence.avgSession")}
                value={formatDuration(avgSession)}
                description={t("presence.avgSessionDesc")}
                info={t("presence.avgSessionTooltip")}
              />
            )}
            {longestSess != null && (
              <StatCard
                label={t("presence.longestSession")}
                value={formatDuration(longestSess)}
                description={t("presence.longestSessionDesc")}
                info={t("presence.longestSessionTooltip")}
              />
            )}
            {avgOnlineSec != null && (
              <StatCard
                label={t("presence.dailyAvg")}
                value={formatDuration(avgOnlineSec) + (trendPct != null ? `  ${trendPct > 0 ? "▲" : "▼"}${Math.abs(trendPct)}%` : "")}
                description={t("presence.dailyAvgDesc")}
                info={t("presence.dailyAvgTooltip")}
              />
            )}
            {streak != null && (
              <StatCard
                label={streak.online ? t("presence.onlineStreak") : t("presence.offlineFor")}
                value={streak.online ? `${streak.days}d` : formatDuration(streak.seconds)}
                description={streak.online ? t("presence.onlineStreakDesc") : t("presence.offlineForDesc")}
                info={streak.online ? t("presence.onlineStreakTooltip") : t("presence.offlineForTooltip")}
              />
            )}
            {longestOffline != null && (
              <StatCard
                label={t("presence.longestOffline")}
                value={`${longestOffline}d`}
                description={t("presence.longestOfflineDesc")}
                info={t("presence.longestOfflineTooltip")}
              />
            )}
            {nightOwlPct != null && (
              <StatCard
                label={t("presence.nightOwl")}
                value={`${nightOwlPct}%`}
                description={t("presence.nightOwlDesc")}
                info={t("presence.nightOwlTooltip")}
              />
            )}
            {consistency != null && (
              <StatCard
                label={t("presence.consistency")}
                value={`${consistency}/100`}
                description={t("presence.consistencyDesc")}
                info={t("presence.consistencyTooltip")}
              />
            )}
            {picFreqDays != null && (
              <StatCard
                label={t("presence.picChanges")}
                value={t("presence.picFreqValue", { n: picFreqDays })}
                description={t("presence.picChangesDesc")}
                info={t("presence.picChangesTooltip")}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Info banners ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {patternSummary && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {t("presence.peakHours")}
                <InfoIcon text={t("presence.peakHoursTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">{t("presence.peakHoursDesc")}</div>
              <div className="mt-1.5 font-semibold text-primary">{patternSummary}</div>
            </CardContent>
          </Card>
        )}
        {sleepWindow && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {t("presence.sleepWindow")}
                <InfoIcon text={t("presence.sleepWindowTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">{t("presence.sleepWindowDesc")}</div>
              <div className="mt-1.5 font-semibold">{sleepWindow}</div>
            </CardContent>
          </Card>
        )}
        {firstSeen && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {t("presence.trackingPeriod")}
                <InfoIcon text={t("presence.trackingPeriodTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">{t("presence.trackingPeriodDesc")}</div>
              <div className="mt-1.5 text-sm">
                <span>{formatDate(firstSeen)}</span>
                <span className="text-muted-foreground"> → </span>
                <span>{formatDate(lastSeen!)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Presence & Activity
          — hourly pattern, weekday pattern, heatmap, 30-day trend
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("presence.presenceActivity")}</p>

        {/* Hourly + Weekday patterns side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.peakHoursChart")}
                <InfoIcon text={t("presence.peakHoursChartTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">{t("presence.peakHoursChartDesc")}</div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={hourlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} interval={3} reversed={isRTL} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} orientation={isRTL ? "right" : "left"} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }} />
                    <Bar dataKey="minutes" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.mostActiveDays")}
                <InfoIcon text={t("presence.mostActiveDaysTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">{t("presence.mostActiveDaysDesc")}</div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={weekdayData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} reversed={isRTL} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} orientation={isRTL ? "right" : "left"} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }} />
                    <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                      {weekdayData.map((d, i) => (
                        <Cell key={i} fill={d.weekend ? "var(--muted-foreground)" : "var(--primary)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Heatmap — full width */}
        {heatmapData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.heatmap")}
                <InfoIcon text={t("presence.heatmapTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">{t("presence.heatmapDesc")}</div>
            </CardHeader>
            <CardContent>
              <Heatmap data={heatmapData} />
            </CardContent>
          </Card>
        )}

        {/* 30-Day Trend — full width */}
        {trend30.length > 1 && (
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.trend30")}
                <InfoIcon text={t("presence.trend30Tooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">{t("presence.trend30Desc")}</div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 190 }}>
                <ResponsiveContainer>
                  <LineChart data={trend30}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} interval={4} reversed={isRTL} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} orientation={isRTL ? "right" : "left"} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="minutes" stroke="var(--primary)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Profile Picture History
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("presence.picHistoryTitle")}</p>
        <Card>
          <CardContent className="pt-4">
            {pictureHistory.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t("presence.picHistoryEmpty")}</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                {pictureHistory.map((e, i) => {
                  const src = getMediaUrl(e.mediaPath!);
                  return (
                    <a key={i} href={src} target="_blank" rel="noreferrer"
                      className="flex flex-col items-center gap-1.5 no-underline">
                      <img
                        src={src}
                        alt={formatDatetime(e.at)}
                        className={`w-full aspect-square object-cover rounded-[10px] ${i === 0 ? "border-2 border-primary" : "border border-border"}`}
                      />
                      <div className="text-center">
                        <div className={`text-xs font-semibold ${i === 0 ? "text-primary" : "text-foreground"}`}>
                          {i === 0 ? t("presence.picLatest") : t("presence.picNumber", { n: pictureHistory.length - i })}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(e.at)}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Status (About) History
      ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("presence.statusHistoryTitle")}</p>
        <Card>
          <CardContent className="pt-4">
            {aboutHistory.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t("presence.statusHistoryEmpty")}</div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {aboutHistory.map((e, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start py-2.5"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-border"}`}
                    />
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="text-sm">
                        {e.text ? e.text : <em className="text-muted-foreground not-italic text-xs">{t("presence.aboutCleared")}</em>}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDatetime(e.at)}</div>
                    </div>
                    {i === 0 && (
                      <span className="text-xs font-semibold text-primary shrink-0 pt-0.5">
                        {t("presence.currentStatus")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section: Other Information
      ══════════════════════════════════════════════════════════ */}
      {contact && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("presence.otherInfo")}</p>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-0">
                <InfoRow label={t("presence.phone")} value={contact.phone} />
                <InfoRow label={t("presence.jid")} value={contact.jid} mono />
                <InfoRow label={t("presence.displayName")} value={contact.displayName || "—"} />
                <InfoRow label={t("presence.tracking")} value={contact.trackingEnabled ? t("presence.trackingActive") : t("presence.trackingPaused")} />
                <InfoRow label={t("presence.added")} value={formatDatetime(contact.addedAt)} />
                {firstSeen && <InfoRow label={t("presence.firstSeen")} value={formatDatetime(firstSeen)} />}
                {lastSeen && <InfoRow label={t("presence.lastSeen")} value={formatDatetime(lastSeen)} />}
                {pictureHistory.length > 0 && (
                  <InfoRow label={t("presence.pictureChanges")} value={t("presence.pictureChangesValue", { count: pictureHistory.length })} />
                )}
                {aboutHistory.length > 0 && (
                  <InfoRow label={t("presence.statusChanges")} value={t("presence.statusChangesValue", { count: aboutHistory.length })} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Export ── */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => exportCSV(safeEntries)}>{t("presence.exportCsv")}</Button>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components

function InfoIcon({ text }: { text: string }) {
  return (
    <ShadTooltip>
      <TooltipTrigger asChild>
        <Info className="size-3 text-muted-foreground/60 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-xs">{text}</TooltipContent>
    </ShadTooltip>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2 border-b border-border flex flex-col gap-0.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, description, info }: { label: string; value: string; description?: string; info?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-24">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {info && <InfoIcon text={info} />}
      </div>
      {description && <p className="text-xs text-muted-foreground/60">{description}</p>}
      <span className="text-lg font-bold">{value}</span>
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
    if (min === 0) return "oklch(0.225 0.013 255)";
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
        <div className="fixed bg-card border border-border rounded text-xs pointer-events-none z-[999] px-2 py-0.5" style={{ left: tooltip.x, top: tooltip.y }}>
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
