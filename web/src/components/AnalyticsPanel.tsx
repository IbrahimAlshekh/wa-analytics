import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { BarChart2, Clock, TrendingUp, MessageSquare, CalendarDays, Smile, Languages } from "lucide-react";
import type { AnalyticsReport, AnalyticsVolumeSide, AnalyticsEmotionCounts, TokenCount, MonthRow } from "../lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { formatCount, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  report: AnalyticsReport;
  contactName: string;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMOTION_KEYS: (keyof AnalyticsEmotionCounts)[] = [
  "love", "miss", "happy", "sad", "care", "encourage", "apology", "gratitude",
];
const EMOTION_ICONS: Record<keyof AnalyticsEmotionCounts, string> = {
  love: "❤️", miss: "💭", happy: "😊", sad: "😢",
  care: "🤗", encourage: "💪", apology: "🙏", gratitude: "🌟",
};

export default function AnalyticsPanel({ report, contactName }: Props) {
  const { t } = useTranslation();
  const { volume, temporal, emotion, timeline, initiation, language, indicators } = report;

  const totalMsgs = volume.me.messages + volume.them.messages;
  if (totalMsgs === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("analytics.noMessages")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TimelineCard timeline={timeline} />
      <VolumeCard me={volume.me} them={volume.them} contactName={contactName} />
      <InitiationCard initiation={initiation} contactName={contactName} />
      <HourHistCard hourMe={temporal.hourHistMe} hourThem={temporal.hourHistThem} contactName={contactName} />
      <DowCard dowMe={temporal.dowMe} dowThem={temporal.dowThem} contactName={contactName} />
      <TemporalMetaCard temporal={temporal} contactName={contactName} />
      <EmotionCard emotion={emotion} contactName={contactName} />
      <LanguageCard language={language} contactName={contactName} />
      <MonthlyEvolutionCard months={temporal.monthly} contactName={contactName} />
      <IndicatorCard indicators={indicators} />
    </div>
  );
}

function SectionHeader({ title, description, info, icon: Icon }: {
  title: string;
  description?: string;
  info?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
          {info && (
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="size-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-xs">{info}</TooltipContent>
            </UITooltip>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground opacity-75 leading-tight">{description}</p>
        )}
      </div>
      {Icon && <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
    </div>
  );
}

function StatItem({ label, value, description, info }: {
  label: string;
  value: string;
  description?: string;
  info?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-24">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info && (
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="size-2.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-xs">{info}</TooltipContent>
          </UITooltip>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground/60 leading-tight">{description}</p>
      )}
      <span className="text-lg font-bold tracking-tight">{value}</span>
    </div>
  );
}

function BalanceBar({ mePct, meLabel, themLabel }: { mePct: number; meLabel: string; themLabel: string }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        <span>{meLabel}</span>
        <span>{themLabel}</span>
      </div>
      <Progress value={mePct} className="h-2" />
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: AnalyticsReport["timeline"] }) {
  const { t } = useTranslation();
  if (!timeline.firstMsgUnix) return null;
  const fmt = (unix: number) => new Date(unix * 1000).toLocaleDateString();
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Timeline"
          description={t("analytics.timeline.description")}
          info={t("analytics.timeline.tooltip")}
          icon={CalendarDays}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem label={t("analytics.timeline.firstMessage")} value={fmt(timeline.firstMsgUnix)} />
          <StatItem label={t("analytics.timeline.lastMessage")} value={fmt(timeline.lastMsgUnix)} />
          <StatItem label={t("analytics.timeline.span")} value={`${timeline.spanDays}d`} />
          <StatItem label={t("analytics.timeline.activeDays")} value={String(timeline.daysWithComms)} />
          <StatItem
            label={t("analytics.timeline.longestStreak")}
            value={`${timeline.longestStreakDays}d`}
            description={t("analytics.timeline.longestStreakDesc")}
            info={t("analytics.timeline.longestStreakTooltip")}
          />
          {timeline.highestVolumeDayDate && (
            <StatItem
              label={t("analytics.timeline.busiestDay")}
              value={`${timeline.highestVolumeDayDate} (${timeline.highestVolumeDayCount})`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InitiationCard({ initiation, contactName }: { initiation: AnalyticsReport["initiation"]; contactName: string }) {
  const { t } = useTranslation();
  if (initiation.sessions === 0) return null;
  const mePct = initiation.initiationMeSharePct;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Initiation & Response"
          description={t("analytics.initiation.description")}
          info={t("analytics.initiation.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <BalanceBar
          mePct={mePct}
          meLabel={t("analytics.initiation.youStarted", { pct: mePct.toFixed(1) })}
          themLabel={t("analytics.initiation.themPct", { name: contactName, pct: (100 - mePct).toFixed(1) })}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem label={t("analytics.initiation.sessions")} value={String(initiation.sessions)} />
          <StatItem label={t("analytics.initiation.avgMsgsPerSession")} value={initiation.avgSessionMsgs.toFixed(1)} />
          {initiation.avgRespMeSec > 0 && <StatItem label={t("analytics.initiation.avgReplyYou")} value={formatDuration(initiation.avgRespMeSec)} />}
          {initiation.avgRespThemSec > 0 && <StatItem label={t("analytics.initiation.avgReplyThem", { name: contactName })} value={formatDuration(initiation.avgRespThemSec)} />}
          {initiation.medianRespMeSec > 0 && <StatItem label={t("analytics.initiation.medianReplyYou")} value={formatDuration(initiation.medianRespMeSec)} />}
          {initiation.medianRespThemSec > 0 && <StatItem label={t("analytics.initiation.medianReplyThem", { name: contactName })} value={formatDuration(initiation.medianRespThemSec)} />}
          {initiation.longestSilenceSec > 0 && (
            <StatItem
              label={t("analytics.initiation.longestSilence")}
              value={formatDuration(initiation.longestSilenceSec)}
              description={t("analytics.initiation.longestSilenceDesc")}
              info={t("analytics.initiation.longestSilenceTooltip")}
            />
          )}
          {initiation.avgSilenceSec > 0 && (
            <StatItem
              label={t("analytics.initiation.avgSilence")}
              value={formatDuration(initiation.avgSilenceSec)}
              description={t("analytics.initiation.avgSilenceDesc")}
              info={t("analytics.initiation.avgSilenceTooltip")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VolumeCard({ me, them, contactName }: { me: AnalyticsVolumeSide; them: AnalyticsVolumeSide; contactName: string }) {
  const { t } = useTranslation();
  const total = me.messages + them.messages;
  const meBar = total > 0 ? (me.messages / total) * 100 : 50;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Volume"
          description={t("analytics.volume.description")}
          info={t("analytics.volume.tooltip")}
          icon={MessageSquare}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <BalanceBar
          mePct={meBar}
          meLabel={t("analytics.volume.youPct", { pct: me.sharePct.toFixed(1) })}
          themLabel={t("analytics.volume.themPct", { name: contactName, pct: them.sharePct.toFixed(1) })}
        />
        <div className="grid grid-cols-2 gap-4">
          <VolumeSideBox label={t("analytics.you")} side={me} accent="text-primary" />
          <VolumeSideBox label={contactName} side={them} accent="text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function VolumeSideBox({ label, side, accent }: { label: string; side: AnalyticsVolumeSide; accent: string }) {
  const { t } = useTranslation();
  const media = side.voiceNotes + side.photos + side.videos + side.stickers + side.documents;
  return (
    <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-2">
      <span className={cn("text-xs font-bold uppercase tracking-wider", accent)}>{label}</span>
      <div className="flex flex-col gap-1.5">
        <MiniStat label={t("analytics.volume.messages")} value={formatCount(side.messages)} />
        <MiniStat label={t("analytics.volume.words")} value={formatCount(side.words)} />
        <MiniStat label={t("analytics.volume.avgWords")} value={side.avgWordsPerMsg.toFixed(1)} />
        {side.voiceNotes > 0 && <MiniStat label={t("analytics.volume.voiceNotes")} value={formatCount(side.voiceNotes)} />}
        {side.photos > 0 && <MiniStat label={t("analytics.volume.photos")} value={formatCount(side.photos)} />}
        {side.videos > 0 && <MiniStat label={t("analytics.volume.videos")} value={formatCount(side.videos)} />}
        {side.stickers > 0 && <MiniStat label={t("analytics.volume.stickers")} value={formatCount(side.stickers)} />}
        {side.documents > 0 && <MiniStat label={t("analytics.volume.docs")} value={formatCount(side.documents)} />}
        {side.links > 0 && <MiniStat label={t("analytics.volume.links")} value={formatCount(side.links)} />}
        {media > 0 && <MiniStat label={t("analytics.volume.totalMedia")} value={formatCount(media)} />}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function HourHistCard({ hourMe, hourThem, contactName }: { hourMe: number[]; hourThem: number[]; contactName: string }) {
  const { t } = useTranslation();
  const data = hourMe.map((me, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    me,
    them: hourThem[h] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Messages by hour"
          description={t("analytics.hourly.description")}
          info={t("analytics.hourly.tooltip")}
          icon={BarChart2}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full h-44">
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }} />
              <Bar dataKey="me" name={t("analytics.you")} fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="them" name={contactName} fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function DowCard({ dowMe, dowThem, contactName }: { dowMe: number[]; dowThem: number[]; contactName: string }) {
  const { t } = useTranslation();
  const data = DOW_LABELS.map((label, i) => ({
    label,
    me: dowMe[i] ?? 0,
    them: dowThem[i] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Messages by weekday"
          description={t("analytics.weekday.description")}
          info={t("analytics.weekday.tooltip")}
          icon={CalendarDays}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full h-40">
          <ResponsiveContainer>
            <BarChart data={data} barCategoryGap="25%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} cursor={{ fill: "oklch(0.723 0.173 145 / 0.08)" }} />
              <Bar dataKey="me" name={t("analytics.you")} fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="them" name={contactName} fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TemporalMetaCard({ temporal, contactName }: { temporal: AnalyticsReport["temporal"]; contactName: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Temporal patterns"
          description={t("analytics.temporal.description")}
          info={t("analytics.temporal.tooltip")}
          icon={Clock}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          <StatItem label={t("analytics.temporal.nightYou")} value={`${temporal.nightPctMe.toFixed(1)}%`} />
          <StatItem label={t("analytics.temporal.nightThem", { name: contactName })} value={`${temporal.nightPctThem.toFixed(1)}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmotionCard({ emotion, contactName }: { emotion: AnalyticsReport["emotion"]; contactName: string }) {
  const { t } = useTranslation();
  const hasEmotion = EMOTION_KEYS.some(
    (k) => (emotion.countsMe[k] ?? 0) > 0 || (emotion.countsThem[k] ?? 0) > 0,
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Emotion fingerprint"
          description={t("analytics.emotion.description")}
          info={t("analytics.emotion.tooltip")}
          icon={Smile}
        />
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {emotion.laughterMsgsMe + emotion.laughterMsgsThem > 0 && (
            <>
              <StatItem label={t("analytics.emotion.laughsYou")} value={formatCount(emotion.laughterMsgsMe)} />
              <StatItem label={t("analytics.emotion.laughsThem", { name: contactName })} value={formatCount(emotion.laughterMsgsThem)} />
            </>
          )}
          {emotion.questionsMe + emotion.questionsThem > 0 && (
            <>
              <StatItem label={t("analytics.emotion.questionsYou")} value={formatCount(emotion.questionsMe)} />
              <StatItem label={t("analytics.emotion.questionsThem", { name: contactName })} value={formatCount(emotion.questionsThem)} />
            </>
          )}
        </div>
        {hasEmotion && (
          <div className="flex flex-col gap-2">
            {EMOTION_KEYS.map((k) => {
              const me = emotion.countsMe[k] ?? 0;
              const them = emotion.countsThem[k] ?? 0;
              if (me === 0 && them === 0) return null;
              return <EmotionRow key={k} icon={EMOTION_ICONS[k]} label={k} me={me} them={them} />;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmotionRow({ icon, label, me, them }: { icon: string; label: string; me: number; them: number }) {
  const total = me + them;
  const mePct = total > 0 ? (me / total) * 100 : 50;
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 text-center text-sm">{icon}</span>
      <span className="w-20 text-xs text-muted-foreground capitalize shrink-0">{label}</span>
      <Progress value={mePct} className="flex-1 h-1.5" />
      <span className="text-xs text-muted-foreground min-w-16 text-end tabular-nums">
        {formatCount(me)} / {formatCount(them)}
      </span>
    </div>
  );
}

function LanguageCard({ language, contactName }: { language: AnalyticsReport["language"]; contactName: string }) {
  const { t } = useTranslation();
  const topEmojisMe = language.topEmojisMe ?? [];
  const topEmojisThem = language.topEmojisThem ?? [];
  const topWordsMe = language.topWordsMe ?? [];
  const topWordsThem = language.topWordsThem ?? [];
  const topDomainsMe = language.topDomainsMe ?? [];
  const topDomainsThem = language.topDomainsThem ?? [];

  const hasEmojis = topEmojisMe.length > 0 || topEmojisThem.length > 0;
  const hasWords = topWordsMe.length > 0 || topWordsThem.length > 0;
  const hasDomains = topDomainsMe.length > 0 || topDomainsThem.length > 0;

  if (!hasEmojis && !hasWords && !hasDomains) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Language fingerprint"
          description={t("analytics.language.description")}
          info={t("analytics.language.tooltip")}
          icon={Languages}
        />
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-5">
        {hasEmojis && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("analytics.language.topEmojis")}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-primary font-bold uppercase mb-2">{t("analytics.you")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {topEmojisMe.map((tc) => <TokenPill key={tc.token} {...tc} />)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase mb-2">{contactName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {topEmojisThem.map((tc) => <TokenPill key={tc.token} {...tc} />)}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasWords && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("analytics.language.topWords")}</p>
            <div className="grid grid-cols-2 gap-4">
              <WordList label={t("analytics.you")} tokens={topWordsMe} accent="text-primary" />
              <WordList label={contactName} tokens={topWordsThem} accent="text-muted-foreground" />
            </div>
          </div>
        )}

        {hasDomains && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t("analytics.language.topDomains")}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-primary font-bold uppercase mb-2">{t("analytics.you")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {topDomainsMe.map((tc) => <TokenPill key={tc.token} {...tc} />)}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase mb-2">{contactName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {topDomainsThem.map((tc) => <TokenPill key={tc.token} {...tc} />)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TokenPill({ token, count }: TokenCount) {
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal">
      <span>{token}</span>
      <span className="text-muted-foreground font-semibold">{formatCount(count)}</span>
    </Badge>
  );
}

function WordList({ label, tokens, accent }: { label: string; tokens: TokenCount[]; accent: string }) {
  return (
    <div>
      <p className={cn("text-xs font-bold uppercase mb-2", accent)}>{label}</p>
      <div className="flex flex-col divide-y divide-border">
        {tokens.map((tc) => (
          <div key={tc.token} className="flex items-baseline justify-between gap-2 py-1">
            <span className="text-xs">{tc.token}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{formatCount(tc.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyEvolutionCard({ months, contactName }: { months: MonthRow[]; contactName: string }) {
  const { t } = useTranslation();
  if (!months || months.length < 2) return null;
  const recent3 = new Set(months.slice(-3).map((m) => m.month));
  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Monthly evolution"
          description={t("analytics.monthly.description")}
          info={t("analytics.monthly.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {[
                { key: "month", label: t("analytics.monthly.month"), align: "left" },
                { key: "you", label: t("analytics.monthly.you"), align: "right" },
                { key: "them", label: contactName, align: "right" },
                { key: "total", label: t("analytics.monthly.total"), align: "right" },
                { key: "yourPct", label: t("analytics.monthly.yourPct"), align: "right" },
              ].map((h) => (
                <th
                  key={h.key}
                  className={cn(
                    "py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border",
                    h.align === "right" ? "text-end" : "text-start",
                  )}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className={cn("border-b border-border", recent3.has(m.month) && "font-bold")}>
                <td className="py-1.5 px-2">{m.month}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.me)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.them)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{formatCount(m.total)}</td>
                <td className="py-1.5 px-2 text-end tabular-nums">{m.meSharePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function IndicatorCard({ indicators }: { indicators: AnalyticsReport["indicators"] }) {
  const { t } = useTranslation();
  const trend = indicators.meShareTrendPct;
  const trendLabel = trend === 0
    ? t("analytics.indicators.shareTrend")
    : trend > 0
      ? t("analytics.indicators.shareTrendUp")
      : t("analytics.indicators.shareTrendDown");

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader
          title="Indicators"
          description={t("analytics.indicators.description")}
          info={t("analytics.indicators.tooltip")}
          icon={TrendingUp}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatItem
            label={t("analytics.indicators.msgBalance")}
            value={`${indicators.msgBalancePct.toFixed(1)}%`}
            description={t("analytics.indicators.msgBalanceDesc")}
            info={t("analytics.indicators.msgBalanceTooltip")}
          />
          <StatItem
            label={t("analytics.indicators.wordBalance")}
            value={`${indicators.wordBalancePct.toFixed(1)}%`}
            description={t("analytics.indicators.wordBalanceDesc")}
            info={t("analytics.indicators.wordBalanceTooltip")}
          />
          <StatItem
            label={t("analytics.indicators.activeDaysPct")}
            value={`${indicators.dailyConsistencyPct.toFixed(1)}%`}
            description={t("analytics.indicators.activeDaysPctDesc")}
            info={t("analytics.indicators.activeDaysPctTooltip")}
          />
          {indicators.medianRespAllSec > 0 && (
            <StatItem
              label={t("analytics.indicators.medianReply")}
              value={formatDuration(indicators.medianRespAllSec)}
              description={t("analytics.indicators.medianReplyDesc")}
              info={t("analytics.indicators.medianReplyTooltip")}
            />
          )}
          <StatItem
            label={t("analytics.indicators.initiationYou")}
            value={`${indicators.initiationMePct.toFixed(1)}%`}
            description={t("analytics.indicators.initiationYouDesc")}
            info={t("analytics.indicators.initiationYouTooltip")}
          />
          {indicators.syncLaughDays > 0 && (
            <StatItem
              label={t("analytics.indicators.syncLaughDays")}
              value={String(indicators.syncLaughDays)}
              description={t("analytics.indicators.syncLaughDaysDesc")}
              info={t("analytics.indicators.syncLaughDaysTooltip")}
            />
          )}
          {indicators.totalQuestions > 0 && (
            <StatItem
              label={t("analytics.indicators.totalQuestions")}
              value={formatCount(indicators.totalQuestions)}
              description={t("analytics.indicators.totalQuestionsDesc")}
            />
          )}
          {indicators.totalLaughter > 0 && (
            <StatItem
              label={t("analytics.indicators.totalLaughter")}
              value={formatCount(indicators.totalLaughter)}
              description={t("analytics.indicators.totalLaughterDesc")}
            />
          )}
          {trend !== 0 && (
            <StatItem
              label={trendLabel}
              value={`${Math.abs(trend).toFixed(1)}%`}
              description={t("analytics.indicators.shareTrendDesc")}
              info={t("analytics.indicators.shareTrendTooltip")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
