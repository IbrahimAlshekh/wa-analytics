import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { AnalyticsReport, AnalyticsVolumeSide, AnalyticsEmotionCounts, TokenCount, MonthRow } from "../lib/types";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  report: AnalyticsReport;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMOTION_KEYS: (keyof AnalyticsEmotionCounts)[] = [
  "love", "miss", "happy", "sad", "care", "encourage", "apology", "gratitude",
];
const EMOTION_ICONS: Record<keyof AnalyticsEmotionCounts, string> = {
  love: "❤️", miss: "💭", happy: "😊", sad: "😢",
  care: "🤗", encourage: "💪", apology: "🙏", gratitude: "🌟",
};

export default function AnalyticsPanel({ report }: Props) {
  const { t } = useTranslation();
  const { volume, temporal, emotion, timeline, initiation, language, indicators } = report;

  const totalMsgs = volume.me.messages + volume.them.messages;
  if (totalMsgs === 0) {
    return (
      <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
        <span className="muted" style={{ fontSize: 13 }}>{t("analytics.noMessages")}</span>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 20 }}>
      <TimelineCard timeline={timeline} />
      <VolumeCard me={volume.me} them={volume.them} />
      <InitiationCard initiation={initiation} />
      <HourHistCard hourMe={temporal.hourHistMe} hourThem={temporal.hourHistThem} />
      <DowCard dowMe={temporal.dowMe} dowThem={temporal.dowThem} />
      <TemporalMetaCard temporal={temporal} />
      <EmotionCard emotion={emotion} />
      <LanguageCard language={language} />
      <MonthlyEvolutionCard months={temporal.monthly} />
      <IndicatorCard indicators={indicators} />
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: AnalyticsReport["timeline"] }) {
  const { t } = useTranslation();
  if (!timeline.firstMsgUnix) return null;
  const fmt = (unix: number) => new Date(unix * 1000).toLocaleDateString();
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.timeline.description")}
        info={t("analytics.timeline.tooltip")}
      >Timeline</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label={t("analytics.timeline.firstMessage")} value={fmt(timeline.firstMsgUnix)} />
        <StatCard label={t("analytics.timeline.lastMessage")} value={fmt(timeline.lastMsgUnix)} />
        <StatCard label={t("analytics.timeline.span")} value={`${timeline.spanDays}d`} />
        <StatCard label={t("analytics.timeline.activeDays")} value={String(timeline.daysWithComms)} />
        <StatCard
          label={t("analytics.timeline.longestStreak")}
          value={`${timeline.longestStreakDays}d`}
          description={t("analytics.timeline.longestStreakDesc")}
          info={t("analytics.timeline.longestStreakTooltip")}
        />
        {timeline.highestVolumeDayDate && (
          <StatCard
            label={t("analytics.timeline.busiestDay")}
            value={`${timeline.highestVolumeDayDate} (${timeline.highestVolumeDayCount})`}
          />
        )}
      </div>
    </div>
  );
}

function InitiationCard({ initiation }: { initiation: AnalyticsReport["initiation"] }) {
  const { t } = useTranslation();
  if (initiation.sessions === 0) return null;

  const mePct = initiation.initiationMeSharePct;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.initiation.description")}
        info={t("analytics.initiation.tooltip")}
      >Initiation &amp; Response</SectionLabel>

      {/* Session initiation balance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
          <span>{t("analytics.initiation.youStarted", { pct: mePct.toFixed(1) })}</span>
          <span>{t("analytics.initiation.themPct", { pct: (100 - mePct).toFixed(1) })}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${mePct}%`, background: "var(--accent)", borderRadius: 4 }} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label={t("analytics.initiation.sessions")} value={String(initiation.sessions)} />
        <StatCard label={t("analytics.initiation.avgMsgsPerSession")} value={initiation.avgSessionMsgs.toFixed(1)} />
        {initiation.avgRespMeSec > 0 && (
          <StatCard label={t("analytics.initiation.avgReplyYou")} value={fmtDur(initiation.avgRespMeSec)} />
        )}
        {initiation.avgRespThemSec > 0 && (
          <StatCard label={t("analytics.initiation.avgReplyThem")} value={fmtDur(initiation.avgRespThemSec)} />
        )}
        {initiation.medianRespMeSec > 0 && (
          <StatCard label={t("analytics.initiation.medianReplyYou")} value={fmtDur(initiation.medianRespMeSec)} />
        )}
        {initiation.medianRespThemSec > 0 && (
          <StatCard label={t("analytics.initiation.medianReplyThem")} value={fmtDur(initiation.medianRespThemSec)} />
        )}
        {initiation.longestSilenceSec > 0 && (
          <StatCard
            label={t("analytics.initiation.longestSilence")}
            value={fmtDur(initiation.longestSilenceSec)}
            description={t("analytics.initiation.longestSilenceDesc")}
            info={t("analytics.initiation.longestSilenceTooltip")}
          />
        )}
        {initiation.avgSilenceSec > 0 && (
          <StatCard
            label={t("analytics.initiation.avgSilence")}
            value={fmtDur(initiation.avgSilenceSec)}
            description={t("analytics.initiation.avgSilenceDesc")}
            info={t("analytics.initiation.avgSilenceTooltip")}
          />
        )}
      </div>
    </div>
  );
}

function VolumeCard({ me, them }: { me: AnalyticsVolumeSide; them: AnalyticsVolumeSide }) {
  const { t } = useTranslation();
  const total = me.messages + them.messages;
  const meBar = total > 0 ? (me.messages / total) * 100 : 50;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.volume.description")}
        info={t("analytics.volume.tooltip")}
      >Volume</SectionLabel>

      {/* Message balance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
          <span>{t("analytics.volume.youPct", { pct: me.sharePct.toFixed(1) })}</span>
          <span>{t("analytics.volume.themPct", { pct: them.sharePct.toFixed(1) })}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${meBar}%`, background: "var(--accent)", borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <VolumeSideBox label={t("analytics.you")} side={me} accent="var(--accent)" />
        <VolumeSideBox label={t("analytics.them")} side={them} accent="var(--fg-muted)" />
      </div>
    </div>
  );
}

function VolumeSideBox({ label, side, accent }: { label: string; side: AnalyticsVolumeSide; accent: string }) {
  const { t } = useTranslation();
  const media = side.voiceNotes + side.photos + side.videos + side.stickers + side.documents;
  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="stats" style={{ marginBottom: 0, gap: 6 }}>
        <MiniStat label={t("analytics.volume.messages")} value={fmt(side.messages)} />
        <MiniStat label={t("analytics.volume.words")} value={fmt(side.words)} />
        <MiniStat label={t("analytics.volume.avgWords")} value={side.avgWordsPerMsg.toFixed(1)} />
        {side.voiceNotes > 0 && <MiniStat label={t("analytics.volume.voiceNotes")} value={fmt(side.voiceNotes)} />}
        {side.photos > 0 && <MiniStat label={t("analytics.volume.photos")} value={fmt(side.photos)} />}
        {side.videos > 0 && <MiniStat label={t("analytics.volume.videos")} value={fmt(side.videos)} />}
        {side.stickers > 0 && <MiniStat label={t("analytics.volume.stickers")} value={fmt(side.stickers)} />}
        {side.documents > 0 && <MiniStat label={t("analytics.volume.docs")} value={fmt(side.documents)} />}
        {side.links > 0 && <MiniStat label={t("analytics.volume.links")} value={fmt(side.links)} />}
        {media > 0 && <MiniStat label={t("analytics.volume.totalMedia")} value={fmt(media)} />}
      </div>
    </div>
  );
}

function HourHistCard({ hourMe, hourThem }: { hourMe: number[]; hourThem: number[] }) {
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
    <div className="card">
      <SectionLabel
        description={t("analytics.hourly.description")}
        info={t("analytics.hourly.tooltip")}
      >Messages by hour</SectionLabel>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={data} barCategoryGap="20%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: "var(--accent-dim)" }}
            />
            <Bar dataKey="me" name={t("analytics.you")} fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="them" name={t("analytics.them")} fill="var(--fg-muted)" radius={[3, 3, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DowCard({ dowMe, dowThem }: { dowMe: number[]; dowThem: number[] }) {
  const { t } = useTranslation();
  const data = DOW_LABELS.map((label, i) => ({
    label,
    me: dowMe[i] ?? 0,
    them: dowThem[i] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;

  return (
    <div className="card">
      <SectionLabel
        description={t("analytics.weekday.description")}
        info={t("analytics.weekday.tooltip")}
      >Messages by weekday</SectionLabel>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={data} barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.1)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: "var(--accent-dim)" }}
            />
            <Bar dataKey="me" name={t("analytics.you")} fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="them" name={t("analytics.them")} fill="var(--fg-muted)" radius={[3, 3, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TemporalMetaCard({ temporal }: { temporal: AnalyticsReport["temporal"] }) {
  const { t } = useTranslation();
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.temporal.description")}
        info={t("analytics.temporal.tooltip")}
      >Temporal patterns</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label={t("analytics.temporal.nightYou")} value={`${temporal.nightPctMe.toFixed(1)}%`} />
        <StatCard label={t("analytics.temporal.nightThem")} value={`${temporal.nightPctThem.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function EmotionCard({ emotion }: { emotion: AnalyticsReport["emotion"] }) {
  const { t } = useTranslation();
  const hasEmotion = EMOTION_KEYS.some(
    (k) => (emotion.countsMe[k] ?? 0) > 0 || (emotion.countsThem[k] ?? 0) > 0,
  );

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.emotion.description")}
        info={t("analytics.emotion.tooltip")}
      >Emotion fingerprint</SectionLabel>

      <div className="stats" style={{ marginBottom: 12 }}>
        {emotion.laughterMsgsMe + emotion.laughterMsgsThem > 0 && (
          <>
            <StatCard label={t("analytics.emotion.laughsYou")} value={fmt(emotion.laughterMsgsMe)} />
            <StatCard label={t("analytics.emotion.laughsThem")} value={fmt(emotion.laughterMsgsThem)} />
          </>
        )}
        {emotion.questionsMe + emotion.questionsThem > 0 && (
          <>
            <StatCard label={t("analytics.emotion.questionsYou")} value={fmt(emotion.questionsMe)} />
            <StatCard label={t("analytics.emotion.questionsThem")} value={fmt(emotion.questionsThem)} />
          </>
        )}
      </div>

      {hasEmotion && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {EMOTION_KEYS.map((k) => {
            const me = emotion.countsMe[k] ?? 0;
            const them = emotion.countsThem[k] ?? 0;
            if (me === 0 && them === 0) return null;
            return (
              <EmotionRow key={k} icon={EMOTION_ICONS[k]} label={k} me={me} them={them} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmotionRow({
  icon, label, me, them,
}: { icon: string; label: string; me: number; them: number }) {
  const total = me + them;
  const mePct = total > 0 ? (me / total) * 100 : 50;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 20, textAlign: "center", fontSize: 14 }}>{icon}</span>
      <span style={{ width: 72, fontSize: 11, color: "var(--fg-muted)", textTransform: "capitalize" }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${mePct}%`, background: "var(--accent)", borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--fg-muted)", minWidth: 70, textAlign: "right" }}>
        {fmt(me)} / {fmt(them)}
      </span>
    </div>
  );
}

function LanguageCard({ language }: { language: AnalyticsReport["language"] }) {
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
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.language.description")}
        info={t("analytics.language.tooltip")}
      >Language fingerprint</SectionLabel>

      {hasEmojis && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>{t("analytics.language.topEmojis")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{t("analytics.you")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {topEmojisMe.map((tc) => (
                  <EmojiPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{t("analytics.them")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {topEmojisThem.map((tc) => (
                  <EmojiPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {hasWords && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>{t("analytics.language.topWords")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <WordList label={t("analytics.you")} tokens={topWordsMe} accent="var(--accent)" />
            <WordList label={t("analytics.them")} tokens={topWordsThem} accent="var(--fg-muted)" />
          </div>
        </div>
      )}

      {hasDomains && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>{t("analytics.language.topDomains")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{t("analytics.you")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {topDomainsMe.map((tc) => (
                  <DomainPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{t("analytics.them")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {topDomainsThem.map((tc) => (
                  <DomainPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmojiPill({ token, count }: TokenCount) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "var(--bg)", borderRadius: 12, padding: "2px 8px",
      border: "1px solid var(--border)", fontSize: 13,
    }}>
      <span>{token}</span>
      <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>{fmt(count)}</span>
    </div>
  );
}

function DomainPill({ token, count }: TokenCount) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "var(--bg)", borderRadius: 12, padding: "2px 8px",
      border: "1px solid var(--border)", fontSize: 11,
    }}>
      <span style={{ color: "var(--fg)" }}>{token}</span>
      <span style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>{fmt(count)}</span>
    </div>
  );
}

function WordList({ label, tokens, accent }: { label: string; tokens: TokenCount[]; accent: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {tokens.map((tc) => (
            <tr key={tc.token} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ fontSize: 12, padding: "3px 0" }}>{tc.token}</td>
              <td style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "right", padding: "3px 0" }}>{fmt(tc.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyEvolutionCard({ months }: { months: MonthRow[] }) {
  const { t } = useTranslation();
  if (!months || months.length < 2) return null;

  const recent3 = new Set(months.slice(-3).map((m) => m.month));

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.monthly.description")}
        info={t("analytics.monthly.tooltip")}
      >Monthly evolution</SectionLabel>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { key: "month", label: t("analytics.monthly.month") },
                { key: "you", label: t("analytics.monthly.you") },
                { key: "them", label: t("analytics.monthly.them") },
                { key: "total", label: t("analytics.monthly.total") },
                { key: "yourPct", label: t("analytics.monthly.yourPct") },
              ].map((h) => (
                <th key={h.key} style={{ textAlign: h.key === "month" ? "left" : "right", padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const isBold = recent3.has(m.month);
              const style: React.CSSProperties = {
                fontWeight: isBold ? 700 : 400,
                borderBottom: "1px solid var(--border)",
              };
              return (
                <tr key={m.month} style={style}>
                  <td style={{ padding: "5px 8px" }}>{m.month}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(m.me)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(m.them)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt(m.total)}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{m.meSharePct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel
        description={t("analytics.indicators.description")}
        info={t("analytics.indicators.tooltip")}
      >Indicators</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard
          label={t("analytics.indicators.msgBalance")}
          value={`${indicators.msgBalancePct.toFixed(1)}%`}
          description={t("analytics.indicators.msgBalanceDesc")}
          info={t("analytics.indicators.msgBalanceTooltip")}
        />
        <StatCard
          label={t("analytics.indicators.wordBalance")}
          value={`${indicators.wordBalancePct.toFixed(1)}%`}
          description={t("analytics.indicators.wordBalanceDesc")}
          info={t("analytics.indicators.wordBalanceTooltip")}
        />
        <StatCard
          label={t("analytics.indicators.activeDaysPct")}
          value={`${indicators.dailyConsistencyPct.toFixed(1)}%`}
          description={t("analytics.indicators.activeDaysPctDesc")}
          info={t("analytics.indicators.activeDaysPctTooltip")}
        />
        {indicators.medianRespAllSec > 0 && (
          <StatCard
            label={t("analytics.indicators.medianReply")}
            value={fmtDur(indicators.medianRespAllSec)}
            description={t("analytics.indicators.medianReplyDesc")}
            info={t("analytics.indicators.medianReplyTooltip")}
          />
        )}
        <StatCard
          label={t("analytics.indicators.initiationYou")}
          value={`${indicators.initiationMePct.toFixed(1)}%`}
          description={t("analytics.indicators.initiationYouDesc")}
          info={t("analytics.indicators.initiationYouTooltip")}
        />
        {indicators.syncLaughDays > 0 && (
          <StatCard
            label={t("analytics.indicators.syncLaughDays")}
            value={String(indicators.syncLaughDays)}
            description={t("analytics.indicators.syncLaughDaysDesc")}
            info={t("analytics.indicators.syncLaughDaysTooltip")}
          />
        )}
        {indicators.totalQuestions > 0 && (
          <StatCard
            label={t("analytics.indicators.totalQuestions")}
            value={fmt(indicators.totalQuestions)}
            description={t("analytics.indicators.totalQuestionsDesc")}
          />
        )}
        {indicators.totalLaughter > 0 && (
          <StatCard
            label={t("analytics.indicators.totalLaughter")}
            value={fmt(indicators.totalLaughter)}
            description={t("analytics.indicators.totalLaughterDesc")}
          />
        )}
        {trend !== 0 && (
          <StatCard
            label={trendLabel}
            value={`${Math.abs(trend).toFixed(1)}%`}
            description={t("analytics.indicators.shareTrendDesc")}
            info={t("analytics.indicators.shareTrendTooltip")}
          />
        )}
      </div>
    </div>
  );
}

// --- helpers ---

function SectionLabel({ children, description, info }: { children: React.ReactNode; description?: string; info?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center" }}>
        {children}
        {info && <InfoTooltip text={info} />}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3, lineHeight: 1.45, opacity: 0.8 }}>
          {description}
        </div>
      )}
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
      <div className="value">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 60 }}>
      <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
