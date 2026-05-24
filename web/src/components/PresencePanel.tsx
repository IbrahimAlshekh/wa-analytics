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
import {
  computePeakHours,
  computeWeekdayActivity,
  computeTrend30Days,
  computeHeatmap,
  computeAvgSessionDuration,
  computeLongestSession,
  computeStreak,
  computeLongestOfflineStreak,
  computeDailyAvgOnline,
  computeNightOwlScore,
  computeConsistencyScore,
  computePicChangeFrequency,
  computeFirstLastSeen,
  computeSleepWindow,
  computeOnlinePatternSummary,
  exportCSV,
  formatDuration,
  formatDate,
  formatDatetime,
  WEEKDAYS,
} from "../lib/presence-stats";

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

