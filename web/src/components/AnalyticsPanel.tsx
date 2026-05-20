import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsReport, AnalyticsVolumeSide, AnalyticsEmotionCounts, TokenCount, MonthRow } from "../lib/types";

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
  const { volume, temporal, emotion, timeline, initiation, language, indicators } = report;

  const totalMsgs = volume.me.messages + volume.them.messages;
  if (totalMsgs === 0) {
    return (
      <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
        <span className="muted" style={{ fontSize: 13 }}>No messages in this range.</span>
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
  if (!timeline.firstMsgUnix) return null;
  const fmt = (unix: number) => new Date(unix * 1000).toLocaleDateString();
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Timeline</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label="First message" value={fmt(timeline.firstMsgUnix)} />
        <StatCard label="Last message" value={fmt(timeline.lastMsgUnix)} />
        <StatCard label="Span" value={`${timeline.spanDays}d`} />
        <StatCard label="Active days" value={String(timeline.daysWithComms)} />
        <StatCard label="Longest streak" value={`${timeline.longestStreakDays}d`} />
        {timeline.highestVolumeDayDate && (
          <StatCard
            label="Busiest day"
            value={`${timeline.highestVolumeDayDate} (${timeline.highestVolumeDayCount})`}
          />
        )}
      </div>
    </div>
  );
}

function InitiationCard({ initiation }: { initiation: AnalyticsReport["initiation"] }) {
  if (initiation.sessions === 0) return null;

  const mePct = initiation.initiationMeSharePct;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Initiation &amp; Response</SectionLabel>

      {/* Session initiation balance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
          <span>You started {mePct.toFixed(1)}%</span>
          <span>Them {(100 - mePct).toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${mePct}%`, background: "var(--accent)", borderRadius: 4 }} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label="Sessions" value={String(initiation.sessions)} />
        <StatCard label="Avg msgs/session" value={initiation.avgSessionMsgs.toFixed(1)} />
        {initiation.avgRespMeSec > 0 && (
          <StatCard label="Avg reply (you)" value={fmtDur(initiation.avgRespMeSec)} />
        )}
        {initiation.avgRespThemSec > 0 && (
          <StatCard label="Avg reply (them)" value={fmtDur(initiation.avgRespThemSec)} />
        )}
        {initiation.medianRespMeSec > 0 && (
          <StatCard label="Median reply (you)" value={fmtDur(initiation.medianRespMeSec)} />
        )}
        {initiation.medianRespThemSec > 0 && (
          <StatCard label="Median reply (them)" value={fmtDur(initiation.medianRespThemSec)} />
        )}
        {initiation.longestSilenceSec > 0 && (
          <StatCard label="Longest silence" value={fmtDur(initiation.longestSilenceSec)} />
        )}
        {initiation.avgSilenceSec > 0 && (
          <StatCard label="Avg silence" value={fmtDur(initiation.avgSilenceSec)} />
        )}
      </div>
    </div>
  );
}

function VolumeCard({ me, them }: { me: AnalyticsVolumeSide; them: AnalyticsVolumeSide }) {
  const total = me.messages + them.messages;
  const meBar = total > 0 ? (me.messages / total) * 100 : 50;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Volume</SectionLabel>

      {/* Message balance bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
          <span>You {me.sharePct.toFixed(1)}%</span>
          <span>Them {them.sharePct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${meBar}%`, background: "var(--accent)", borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <VolumeSideBox label="You" side={me} accent="var(--accent)" />
        <VolumeSideBox label="Them" side={them} accent="var(--fg-muted)" />
      </div>
    </div>
  );
}

function VolumeSideBox({ label, side, accent }: { label: string; side: AnalyticsVolumeSide; accent: string }) {
  const media = side.voiceNotes + side.photos + side.videos + side.stickers + side.documents;
  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="stats" style={{ marginBottom: 0, gap: 6 }}>
        <MiniStat label="Messages" value={fmt(side.messages)} />
        <MiniStat label="Words" value={fmt(side.words)} />
        <MiniStat label="Avg words" value={side.avgWordsPerMsg.toFixed(1)} />
        {side.voiceNotes > 0 && <MiniStat label="Voice notes" value={fmt(side.voiceNotes)} />}
        {side.photos > 0 && <MiniStat label="Photos" value={fmt(side.photos)} />}
        {side.videos > 0 && <MiniStat label="Videos" value={fmt(side.videos)} />}
        {side.stickers > 0 && <MiniStat label="Stickers" value={fmt(side.stickers)} />}
        {side.documents > 0 && <MiniStat label="Docs" value={fmt(side.documents)} />}
        {side.links > 0 && <MiniStat label="Links" value={fmt(side.links)} />}
        {media > 0 && <MiniStat label="Total media" value={fmt(media)} />}
      </div>
    </div>
  );
}

function HourHistCard({ hourMe, hourThem }: { hourMe: number[]; hourThem: number[] }) {
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
      <SectionLabel>Messages by hour</SectionLabel>
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
            <Bar dataKey="me" name="You" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="them" name="Them" fill="var(--fg-muted)" radius={[3, 3, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DowCard({ dowMe, dowThem }: { dowMe: number[]; dowThem: number[] }) {
  const data = DOW_LABELS.map((label, i) => ({
    label,
    me: dowMe[i] ?? 0,
    them: dowThem[i] ?? 0,
  }));
  const hasData = data.some((d) => d.me > 0 || d.them > 0);
  if (!hasData) return null;

  return (
    <div className="card">
      <SectionLabel>Messages by weekday</SectionLabel>
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
            <Bar dataKey="me" name="You" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="them" name="Them" fill="var(--fg-muted)" radius={[3, 3, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TemporalMetaCard({ temporal }: { temporal: AnalyticsReport["temporal"] }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Temporal patterns</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label="Night messages (you)" value={`${temporal.nightPctMe.toFixed(1)}%`} />
        <StatCard label="Night messages (them)" value={`${temporal.nightPctThem.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function EmotionCard({ emotion }: { emotion: AnalyticsReport["emotion"] }) {
  const hasEmotion = EMOTION_KEYS.some(
    (k) => (emotion.countsMe[k] ?? 0) > 0 || (emotion.countsThem[k] ?? 0) > 0,
  );

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Emotion fingerprint</SectionLabel>

      <div className="stats" style={{ marginBottom: 12 }}>
        {emotion.laughterMsgsMe + emotion.laughterMsgsThem > 0 && (
          <>
            <StatCard label="Laughs (you)" value={fmt(emotion.laughterMsgsMe)} />
            <StatCard label="Laughs (them)" value={fmt(emotion.laughterMsgsThem)} />
          </>
        )}
        {emotion.questionsMe + emotion.questionsThem > 0 && (
          <>
            <StatCard label="Questions (you)" value={fmt(emotion.questionsMe)} />
            <StatCard label="Questions (them)" value={fmt(emotion.questionsThem)} />
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
  const hasEmojis = language.topEmojisMe.length > 0 || language.topEmojisThem.length > 0;
  const hasWords = language.topWordsMe.length > 0 || language.topWordsThem.length > 0;
  const hasDomains = language.topDomainsMe.length > 0 || language.topDomainsThem.length > 0;

  if (!hasEmojis && !hasWords && !hasDomains) return null;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Language fingerprint</SectionLabel>

      {hasEmojis && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>Top emojis</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>You</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {language.topEmojisMe.map((tc) => (
                  <EmojiPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Them</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {language.topEmojisThem.map((tc) => (
                  <EmojiPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {hasWords && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>Top words</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <WordList label="You" tokens={language.topWordsMe} accent="var(--accent)" />
            <WordList label="Them" tokens={language.topWordsThem} accent="var(--fg-muted)" />
          </div>
        </div>
      )}

      {hasDomains && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 8 }}>Top domains</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>You</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {language.topDomainsMe.map((tc) => (
                  <DomainPill key={tc.token} token={tc.token} count={tc.count} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" }}>Them</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {language.topDomainsThem.map((tc) => (
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
  if (!months || months.length < 2) return null;

  const recent3 = new Set(months.slice(-3).map((m) => m.month));

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Monthly evolution</SectionLabel>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Month", "You", "Them", "Total", "Your %"].map((h) => (
                <th key={h} style={{ textAlign: h === "Month" ? "left" : "right", padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
                  {h}
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
  const trend = indicators.meShareTrendPct;
  const trendLabel = trend === 0
    ? "Share trend"
    : trend > 0
      ? `Share trend ▲`
      : `Share trend ▼`;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <SectionLabel>Indicators</SectionLabel>
      <div className="stats" style={{ marginBottom: 0 }}>
        <StatCard label="Msg balance (you)" value={`${indicators.msgBalancePct.toFixed(1)}%`} />
        <StatCard label="Word balance (you)" value={`${indicators.wordBalancePct.toFixed(1)}%`} />
        <StatCard label="Active days %" value={`${indicators.dailyConsistencyPct.toFixed(1)}%`} />
        {indicators.medianRespAllSec > 0 && (
          <StatCard label="Median reply (all)" value={fmtDur(indicators.medianRespAllSec)} />
        )}
        <StatCard label="Initiation (you)" value={`${indicators.initiationMePct.toFixed(1)}%`} />
        {indicators.syncLaughDays > 0 && (
          <StatCard label="Sync laugh days" value={String(indicators.syncLaughDays)} />
        )}
        {indicators.totalQuestions > 0 && (
          <StatCard label="Total questions" value={fmt(indicators.totalQuestions)} />
        )}
        {indicators.totalLaughter > 0 && (
          <StatCard label="Total laughter" value={fmt(indicators.totalLaughter)} />
        )}
        {trend !== 0 && (
          <StatCard label={trendLabel} value={`${Math.abs(trend).toFixed(1)}%`} />
        )}
      </div>
    </div>
  );
}

// --- helpers ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
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
