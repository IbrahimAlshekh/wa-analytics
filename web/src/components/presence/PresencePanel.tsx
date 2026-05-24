import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { Contact } from "@/types/contact";
import type { TimelineEntry } from "@/types/timeline";
import { getMediaUrl } from "@/lib/media";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/lib/presence-stats";
import InfoIcon from "./InfoIcon";
import InfoRow from "./InfoRow";
import PresenceStatCard from "./PresenceStatCard";
import Heatmap from "./Heatmap";

export interface PresencePanelProps {
  entries: TimelineEntry[];
  contact?: Contact;
}

export default function PresencePanel({
  entries,
  contact,
}: PresencePanelProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  const safeEntries = entries ?? [];
  const hourlyData = computePeakHours(safeEntries);
  const weekdayData = computeWeekdayActivity(safeEntries);
  const trend30 = computeTrend30Days(safeEntries);
  const heatmapData = computeHeatmap(safeEntries);

  const avgSession = computeAvgSessionDuration(safeEntries);
  const longestSess = computeLongestSession(safeEntries);
  const streak = computeStreak(safeEntries);
  const { avgOnlineSec, trendPct } = computeDailyAvgOnline(safeEntries);
  const nightOwlPct = computeNightOwlScore(safeEntries);
  const consistency = computeConsistencyScore(safeEntries);
  const picFreqDays = computePicChangeFrequency(safeEntries);
  const { firstSeen, lastSeen } = computeFirstLastSeen(safeEntries);
  const sleepWindow = computeSleepWindow(safeEntries);
  const longestOffline = computeLongestOfflineStreak(safeEntries);

  const patternSummary = computeOnlinePatternSummary(hourlyData);

  const aboutHistory = safeEntries
    .filter((e) => e.kind === "about")
    .sort((a, b) => b.at - a.at);
  const pictureHistory = safeEntries
    .filter((e) => e.kind === "picture" && e.mediaPath)
    .sort((a, b) => b.at - a.at);

  const hasPresence = hourlyData.some((d) => d.minutes > 0);
  if (!hasPresence) return null;

  return (
    <div className="flex flex-col gap-5">
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
              <PresenceStatCard
                label={t("presence.avgSession")}
                value={formatDuration(avgSession)}
                description={t("presence.avgSessionDesc")}
                info={t("presence.avgSessionTooltip")}
              />
            )}
            {longestSess != null && (
              <PresenceStatCard
                label={t("presence.longestSession")}
                value={formatDuration(longestSess)}
                description={t("presence.longestSessionDesc")}
                info={t("presence.longestSessionTooltip")}
              />
            )}
            {avgOnlineSec != null && (
              <PresenceStatCard
                label={t("presence.dailyAvg")}
                value={
                  formatDuration(avgOnlineSec) +
                  (trendPct != null
                    ? `  ${trendPct > 0 ? "▲" : "▼"}${Math.abs(trendPct)}%`
                    : "")
                }
                description={t("presence.dailyAvgDesc")}
                info={t("presence.dailyAvgTooltip")}
              />
            )}
            {streak != null && (
              <PresenceStatCard
                label={
                  streak.online
                    ? t("presence.onlineStreak")
                    : t("presence.offlineFor")
                }
                value={
                  streak.online
                    ? `${streak.days}d`
                    : formatDuration(streak.seconds)
                }
                description={
                  streak.online
                    ? t("presence.onlineStreakDesc")
                    : t("presence.offlineForDesc")
                }
                info={
                  streak.online
                    ? t("presence.onlineStreakTooltip")
                    : t("presence.offlineForTooltip")
                }
              />
            )}
            {longestOffline != null && (
              <PresenceStatCard
                label={t("presence.longestOffline")}
                value={`${longestOffline}d`}
                description={t("presence.longestOfflineDesc")}
                info={t("presence.longestOfflineTooltip")}
              />
            )}
            {nightOwlPct != null && (
              <PresenceStatCard
                label={t("presence.nightOwl")}
                value={`${nightOwlPct}%`}
                description={t("presence.nightOwlDesc")}
                info={t("presence.nightOwlTooltip")}
              />
            )}
            {consistency != null && (
              <PresenceStatCard
                label={t("presence.consistency")}
                value={`${consistency}/100`}
                description={t("presence.consistencyDesc")}
                info={t("presence.consistencyTooltip")}
              />
            )}
            {picFreqDays != null && (
              <PresenceStatCard
                label={t("presence.picChanges")}
                value={t("presence.picFreqValue", { n: picFreqDays })}
                description={t("presence.picChangesDesc")}
                info={t("presence.picChangesTooltip")}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {patternSummary && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {t("presence.peakHours")}
                <InfoIcon text={t("presence.peakHoursTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">
                {t("presence.peakHoursDesc")}
              </div>
              <div className="mt-1.5 font-semibold text-primary">
                {patternSummary}
              </div>
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
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">
                {t("presence.sleepWindowDesc")}
              </div>
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
              <div className="text-xs text-muted-foreground mt-0.5 opacity-70">
                {t("presence.trackingPeriodDesc")}
              </div>
              <div className="mt-1.5 text-sm">
                <span>{formatDate(firstSeen)}</span>
                <span className="text-muted-foreground"> → </span>
                <span>{formatDate(lastSeen!)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("presence.presenceActivity")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.peakHoursChart")}
                <InfoIcon text={t("presence.peakHoursChartTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">
                {t("presence.peakHoursChartDesc")}
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={hourlyData} barCategoryGap="20%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(127,127,127,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                      reversed={isRTL}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      orientation={isRTL ? "right" : "left"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }}
                    />
                    <Bar
                      dataKey="minutes"
                      fill="var(--primary)"
                      radius={[3, 3, 0, 0]}
                    />
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
              <div className="text-xs text-muted-foreground">
                {t("presence.mostActiveDaysDesc")}
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={weekdayData} barCategoryGap="20%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(127,127,127,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      reversed={isRTL}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      orientation={isRTL ? "right" : "left"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }}
                    />
                    <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                      {weekdayData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.weekend
                              ? "var(--muted-foreground)"
                              : "var(--primary)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {heatmapData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.heatmap")}
                <InfoIcon text={t("presence.heatmapTooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">
                {t("presence.heatmapDesc")}
              </div>
            </CardHeader>
            <CardContent>
              <Heatmap data={heatmapData} />
            </CardContent>
          </Card>
        )}

        {trend30.length > 1 && (
          <Card>
            <CardHeader>
              <div className="font-semibold text-sm flex items-center gap-1">
                {t("presence.trend30")}
                <InfoIcon text={t("presence.trend30Tooltip")} />
              </div>
              <div className="text-xs text-muted-foreground">
                {t("presence.trend30Desc")}
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 190 }}>
                <ResponsiveContainer>
                  <LineChart data={trend30}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(127,127,127,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                      reversed={isRTL}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "var(--fg-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                      orientation={isRTL ? "right" : "left"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="var(--primary)"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("presence.picHistoryTitle")}
        </p>
        <Card>
          <CardContent className="pt-4">
            {pictureHistory.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                {t("presence.picHistoryEmpty")}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                {pictureHistory.map((e, i) => {
                  const src = getMediaUrl(e.mediaPath!);
                  return (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center gap-1.5 no-underline"
                    >
                      <img
                        src={src}
                        alt={formatDatetime(e.at)}
                        className={`w-full aspect-square object-cover rounded-[10px] ${i === 0 ? "border-2 border-primary" : "border border-border"}`}
                      />
                      <div className="text-center">
                        <div
                          className={`text-xs font-semibold ${i === 0 ? "text-primary" : "text-foreground"}`}
                        >
                          {i === 0
                            ? t("presence.picLatest")
                            : t("presence.picNumber", {
                                n: pictureHistory.length - i,
                              })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(e.at)}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("presence.statusHistoryTitle")}
        </p>
        <Card>
          <CardContent className="pt-4">
            {aboutHistory.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                {t("presence.statusHistoryEmpty")}
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {aboutHistory.map((e, i) => (
                  <div key={i} className="flex gap-3 items-start py-2.5">
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-border"}`}
                    />
                    <div className="flex flex-col gap-0.5 flex-1">
                      <div className="text-sm">
                        {e.text ? (
                          e.text
                        ) : (
                          <em className="text-muted-foreground not-italic text-xs">
                            {t("presence.aboutCleared")}
                          </em>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDatetime(e.at)}
                      </div>
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

      {contact && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("presence.otherInfo")}
          </p>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-0">
                <InfoRow label={t("presence.phone")} value={contact.phone} />
                <InfoRow label={t("presence.jid")} value={contact.jid} mono />
                <InfoRow
                  label={t("presence.displayName")}
                  value={contact.displayName || "—"}
                />
                <InfoRow
                  label={t("presence.tracking")}
                  value={
                    contact.trackingEnabled
                      ? t("presence.trackingActive")
                      : t("presence.trackingPaused")
                  }
                />
                <InfoRow
                  label={t("presence.added")}
                  value={formatDatetime(contact.addedAt)}
                />
                {firstSeen && (
                  <InfoRow
                    label={t("presence.firstSeen")}
                    value={formatDatetime(firstSeen)}
                  />
                )}
                {lastSeen && (
                  <InfoRow
                    label={t("presence.lastSeen")}
                    value={formatDatetime(lastSeen)}
                  />
                )}
                {pictureHistory.length > 0 && (
                  <InfoRow
                    label={t("presence.pictureChanges")}
                    value={t("presence.pictureChangesValue", {
                      count: pictureHistory.length,
                    })}
                  />
                )}
                {aboutHistory.length > 0 && (
                  <InfoRow
                    label={t("presence.statusChanges")}
                    value={t("presence.statusChangesValue", {
                      count: aboutHistory.length,
                    })}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(safeEntries)}
        >
          {t("presence.exportCsv")}
        </Button>
      </div>
    </div>
  );
}
