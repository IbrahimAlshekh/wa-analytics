import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
export default function InsightsPanel({ entries }) {
    const hourlyData = computePeakHours(entries);
    const weekdayData = computeWeekdayActivity(entries);
    const msgFreqData = computeMessageFrequency(entries);
    const trend30 = computeTrend30Days(entries);
    const msgHourData = computeMsgHourActivity(entries);
    const heatmapData = computeHeatmap(entries);
    const avgSession = computeAvgSessionDuration(entries);
    const longestSess = computeLongestSession(entries);
    const avgResponse = computeAvgResponseTime(entries);
    const streak = computeStreak(entries);
    const { avgOnlineSec, trendPct } = computeDailyAvgOnline(entries);
    const nightOwlPct = computeNightOwlScore(entries);
    const consistency = computeConsistencyScore(entries);
    const { sentPerDay, receivedPerDay } = computeMsgPerDay(entries);
    const { ghostRate, initiatorPct, avgConvLen, doubleTextPct } = computeConversationStats(entries);
    const mediaRatio = computeMediaRatio(entries);
    const picFreqDays = computePicChangeFrequency(entries);
    const { firstSeen, lastSeen } = computeFirstLastSeen(entries);
    const sleepWindow = computeSleepWindow(entries);
    const longestOffline = computeLongestOfflineStreak(entries);
    const patternSummary = computeOnlinePatternSummary(hourlyData);
    const aboutHistory = entries.filter((e) => e.kind === "about").sort((a, b) => b.at - a.at);
    const pictureHistory = entries.filter((e) => e.kind === "picture" && e.url).sort((a, b) => b.at - a.at);
    const hasPresence = hourlyData.some((d) => d.minutes > 0);
    if (!hasPresence)
        return null;
    const hasMsgCharts = msgHourData.some((d) => d.count > 0) || msgFreqData.length > 0;
    return (_jsxs("div", { className: "col", style: { gap: 20 }, children: [_jsxs("div", { className: "card", style: { padding: "14px 16px" }, children: [_jsx("div", { className: "muted", style: { fontSize: 10, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }, children: "Presence" }), _jsxs("div", { className: "stats", style: { marginBottom: 0 }, children: [avgSession != null && _jsx(StatCard, { label: "Avg session", value: formatDuration(avgSession) }), longestSess != null && _jsx(StatCard, { label: "Longest session", value: formatDuration(longestSess) }), avgOnlineSec != null && _jsx(StatCard, { label: "Daily avg online", value: formatDuration(avgOnlineSec) + (trendPct != null ? `  ${trendPct > 0 ? "▲" : "▼"}${Math.abs(trendPct)}%` : "") }), streak != null && _jsx(StatCard, { label: streak.online ? "Online streak" : "Offline for", value: streak.online ? `${streak.days}d` : formatDuration(streak.seconds) }), longestOffline != null && _jsx(StatCard, { label: "Longest offline", value: `${longestOffline}d` }), nightOwlPct != null && _jsx(StatCard, { label: "Night owl", value: `${nightOwlPct}%` }), consistency != null && _jsx(StatCard, { label: "Consistency", value: `${consistency}/100` })] })] }), (avgResponse != null || sentPerDay != null || ghostRate != null) && (_jsxs("div", { className: "card", style: { padding: "14px 16px" }, children: [_jsx("div", { className: "muted", style: { fontSize: 10, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em" }, children: "Conversation" }), _jsxs("div", { className: "stats", style: { marginBottom: 0 }, children: [avgResponse != null && _jsx(StatCard, { label: "Avg response time", value: formatDuration(avgResponse) }), sentPerDay != null && _jsx(StatCard, { label: "Msgs sent / day", value: sentPerDay.toFixed(1) }), receivedPerDay != null && _jsx(StatCard, { label: "Msgs recv / day", value: receivedPerDay.toFixed(1) }), ghostRate != null && _jsx(StatCard, { label: "Ghost rate", value: `${ghostRate}%` }), initiatorPct != null && _jsx(StatCard, { label: "You initiated", value: `${initiatorPct}%` }), avgConvLen != null && _jsx(StatCard, { label: "Avg conv length", value: `${avgConvLen} msgs` }), doubleTextPct != null && _jsx(StatCard, { label: "They double-text", value: `${doubleTextPct}%` }), mediaRatio != null && _jsx(StatCard, { label: "Media ratio", value: `${mediaRatio}%` }), picFreqDays != null && _jsx(StatCard, { label: "Pic changes", value: `every ${picFreqDays}d` })] })] })), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }, children: [patternSummary && (_jsxs("div", { className: "card", style: { padding: "12px 16px" }, children: [_jsx("div", { className: "muted", style: { fontSize: 11 }, children: "Peak hours" }), _jsx("div", { style: { marginTop: 4, fontWeight: 600, color: "var(--accent)" }, children: patternSummary })] })), sleepWindow && (_jsxs("div", { className: "card", style: { padding: "12px 16px" }, children: [_jsx("div", { className: "muted", style: { fontSize: 11 }, children: "Sleep window (est.)" }), _jsx("div", { style: { marginTop: 4, fontWeight: 600 }, children: sleepWindow })] })), firstSeen && (_jsxs("div", { className: "card", style: { padding: "12px 16px" }, children: [_jsx("div", { className: "muted", style: { fontSize: 11 }, children: "Tracking period" }), _jsxs("div", { style: { marginTop: 4, fontSize: 13 }, children: [_jsx("span", { children: formatDate(firstSeen) }), _jsx("span", { className: "muted", children: " \u2192 " }), _jsx("span", { children: formatDate(lastSeen) })] })] }))] }), _jsxs("div", { className: "col", style: { gap: 12 }, children: [_jsx("div", { className: "section-label", children: "Presence & Activity" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "Peak Activity Hours" }), _jsx("div", { className: "muted", style: { fontSize: 12, marginBottom: 10 }, children: "Online minutes by hour of day" }), _jsx("div", { style: { width: "100%", height: 180 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: hourlyData, barCategoryGap: "20%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "hour", tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, interval: 3 }), _jsx(YAxis, { tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 28 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--accent-dim)" } }), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)", radius: [3, 3, 0, 0] })] }) }) })] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "Most Active Days" }), _jsx("div", { className: "muted", style: { fontSize: 12, marginBottom: 10 }, children: "Online minutes by day of week" }), _jsx("div", { style: { width: "100%", height: 180 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: weekdayData, barCategoryGap: "20%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "day", tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 28 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--accent-dim)" } }), _jsx(Bar, { dataKey: "minutes", radius: [3, 3, 0, 0], children: weekdayData.map((d, i) => (_jsx(Cell, { fill: d.weekend ? "var(--offline)" : "var(--accent)" }, i))) })] }) }) })] })] }), heatmapData.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "Activity Heatmap" }), _jsx("div", { className: "muted", style: { fontSize: 12, marginBottom: 14 }, children: "Daily online time \u2014 last 16 weeks" }), _jsx(Heatmap, { data: heatmapData })] })), trend30.length > 1 && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "30-Day Online Trend" }), _jsx("div", { className: "muted", style: { fontSize: 12, marginBottom: 10 }, children: "Online minutes per day" }), _jsx("div", { style: { width: "100%", height: 190 }, children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: trend30, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, interval: 4 }), _jsx(YAxis, { tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 28 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } }), _jsx(Line, { type: "monotone", dataKey: "minutes", stroke: "var(--accent)", dot: false, strokeWidth: 2 })] }) }) })] }))] }), hasMsgCharts && (_jsxs("div", { className: "col", style: { gap: 12 }, children: [_jsx("div", { className: "section-label", children: "Messaging" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [msgHourData.some((d) => d.count > 0) && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "Peak Messaging Hours" }), _jsx("div", { className: "muted", style: { fontSize: 12, marginBottom: 10 }, children: "Messages sent by hour of day" }), _jsx("div", { style: { width: "100%", height: 180 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: msgHourData, barCategoryGap: "20%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "hour", tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, interval: 3 }), _jsx(YAxis, { tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 28 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--accent-dim)" } }), _jsx(Bar, { dataKey: "count", fill: "var(--accent)", radius: [3, 3, 0, 0] })] }) }) })] })), msgFreqData.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 2 }, children: "Message Frequency" }), _jsxs("div", { className: "muted", style: { fontSize: 12, marginBottom: 10 }, children: ["Sent ", _jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--accent)", verticalAlign: "middle", margin: "0 3px" } }), "vs Received ", _jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--offline)", verticalAlign: "middle", margin: "0 3px" } }), "per day"] }), _jsx("div", { style: { width: "100%", height: 180 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: msgFreqData, barCategoryGap: "20%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, interval: Math.floor(msgFreqData.length / 6) }), _jsx(YAxis, { tick: { fontSize: 9, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 28 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--accent-dim)" } }), _jsx(Bar, { dataKey: "sent", fill: "var(--accent)", name: "Sent", radius: [3, 3, 0, 0] }), _jsx(Bar, { dataKey: "received", fill: "var(--offline)", name: "Received", radius: [3, 3, 0, 0] })] }) }) })] }))] })] })), _jsxs("div", { className: "col", style: { gap: 12 }, children: [_jsx("div", { className: "section-label", children: "History" }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: [_jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 10 }, children: "About History" }), aboutHistory.length === 0 ? (_jsx("div", { className: "muted", children: "No about changes recorded." })) : (_jsx("div", { className: "col", style: { gap: 8, maxHeight: 220, overflowY: "auto" }, children: aboutHistory.map((e, i) => (_jsxs("div", { style: { borderBottom: "1px solid var(--border)", paddingBottom: 6 }, children: [_jsx("div", { className: "muted", style: { fontSize: 11, marginBottom: 2 }, children: formatDatetime(e.at) }), _jsx("div", { style: { fontSize: 13 }, children: e.text || _jsx("em", { className: "muted", children: "(empty)" }) })] }, i))) }))] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 10 }, children: "Profile Picture History" }), pictureHistory.length === 0 ? (_jsx("div", { className: "muted", children: "No profile pictures recorded." })) : (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }, children: pictureHistory.map((e, i) => (_jsxs("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }, children: [_jsx("img", { src: e.url, alt: formatDatetime(e.at), style: { width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" } }), _jsx("span", { className: "muted", style: { fontSize: 10 }, children: formatDate(e.at) })] }, i))) }))] })] })] }), _jsx("div", { style: { display: "flex", justifyContent: "flex-end" }, children: _jsx("button", { className: "btn", onClick: () => exportCSV(entries), children: "Export CSV" }) })] }));
}
// ---------------------------------------------------------------------------
// Sub-components
function StatCard({ label, value }) {
    return (_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: label }), _jsx("div", { className: "value", style: { fontSize: "1.1rem" }, children: value })] }));
}
function Heatmap({ data }) {
    const [tooltip, setTooltip] = useState(null);
    // Group by week — each week is a column (Mon start)
    const weeks = [];
    let week = [];
    for (const d of data) {
        const dow = new Date(d.date + "T00:00:00").getDay(); // 0=Sun
        const monDow = dow === 0 ? 6 : dow - 1; // 0=Mon
        if (week.length === 0 && monDow !== 0) {
            // Pad first week
            for (let i = 0; i < monDow; i++)
                week.push({ date: "", minutes: -1, dow: i });
        }
        week.push({ ...d, dow: monDow });
        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }
    }
    if (week.length > 0)
        weeks.push(week);
    const maxMin = Math.max(...data.map((d) => d.minutes), 1);
    const cellColor = (min) => {
        if (min < 0)
            return "transparent";
        if (min === 0)
            return "var(--border)";
        const intensity = Math.min(min / maxMin, 1);
        return `rgba(22,163,74,${0.15 + intensity * 0.85})`;
    };
    const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
    return (_jsxs("div", { style: { position: "relative", display: "inline-block" }, children: [_jsxs("div", { style: { display: "flex", gap: 3, alignItems: "flex-start" }, children: [_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 3, marginRight: 2 }, children: dayLabels.map((l, i) => (_jsx("div", { className: "muted", style: { width: 10, height: 12, fontSize: 9, lineHeight: "12px", textAlign: "right" }, children: l }, i))) }), weeks.map((w, wi) => (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 3 }, children: Array.from({ length: 7 }, (_, di) => {
                            const cell = w[di];
                            return (_jsx("div", { style: { width: 12, height: 12, borderRadius: 2, backgroundColor: cell ? cellColor(cell.minutes) : "transparent", cursor: cell && cell.minutes >= 0 ? "default" : undefined }, onMouseEnter: cell && cell.date ? (e) => {
                                    const r = e.target.getBoundingClientRect();
                                    setTooltip({ text: `${cell.date}: ${cell.minutes}m`, x: r.left, y: r.top - 28 });
                                } : undefined, onMouseLeave: () => setTooltip(null) }, di));
                        }) }, wi)))] }), tooltip && (_jsx("div", { style: {
                    position: "fixed", left: tooltip.x, top: tooltip.y,
                    background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 4, padding: "2px 8px", fontSize: 11, pointerEvents: "none", zIndex: 999,
                }, children: tooltip.text }))] }));
}
// ---------------------------------------------------------------------------
// Computations
function computePeakHours(entries) {
    const buckets = new Array(24).fill(0);
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            distributeToHours(buckets, onlineAt, p.at);
            onlineAt = null;
        }
    }
    if (onlineAt != null)
        distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
    return buckets.map((sec, i) => ({ hour: i.toString().padStart(2, "0"), minutes: Math.round(sec / 60) }));
}
function distributeToHours(buckets, start, end) {
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
function computeWeekdayActivity(entries) {
    const buckets = new Array(7).fill(0);
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            distributeToWeekdays(buckets, onlineAt, p.at);
            onlineAt = null;
        }
    }
    if (onlineAt != null)
        distributeToWeekdays(buckets, onlineAt, Math.floor(Date.now() / 1000));
    return [1, 2, 3, 4, 5, 6, 0].map((i) => ({
        day: WEEKDAYS[i],
        minutes: Math.round(buckets[i] / 60),
        weekend: i === 0 || i === 6,
    }));
}
function distributeToWeekdays(buckets, start, end) {
    let cur = start;
    while (cur < end) {
        const d = new Date(cur * 1000);
        const dow = d.getDay();
        const next = new Date(d);
        next.setHours(24, 0, 0, 0);
        const sliceEnd = Math.min(end, Math.floor(next.getTime() / 1000));
        buckets[dow] += sliceEnd - cur;
        cur = sliceEnd;
    }
}
function computeAvgSessionDuration(entries) {
    const { durations } = parseSessions(entries);
    if (durations.length === 0)
        return null;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}
function computeLongestSession(entries) {
    const { durations } = parseSessions(entries);
    if (durations.length === 0)
        return null;
    return Math.max(...durations);
}
function parseSessions(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    const durations = [];
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            durations.push(p.at - onlineAt);
            onlineAt = null;
        }
    }
    return { durations };
}
function computeAvgResponseTime(entries) {
    const messages = entries.filter((e) => e.kind === "message").sort((a, b) => a.at - b.at);
    const gaps = [];
    let lastReceivedAt = null;
    for (const m of messages) {
        if (!m.isFromMe) {
            lastReceivedAt = m.at;
        }
        else if (m.isFromMe && lastReceivedAt != null) {
            const gap = m.at - lastReceivedAt;
            if (gap > 0 && gap < 86400)
                gaps.push(gap);
            lastReceivedAt = null;
        }
    }
    if (gaps.length === 0)
        return null;
    return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}
function computeStreak(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return null;
    const last = presence[presence.length - 1];
    if (last.state === "unavailable") {
        return { online: false, days: 0, seconds: Math.floor(Date.now() / 1000) - last.at };
    }
    const activeDays = new Set();
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10));
            onlineAt = null;
        }
    }
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (activeDays.has(d.toISOString().slice(0, 10)))
            streak++;
        else
            break;
    }
    return { online: true, days: streak, seconds: 0 };
}
function computeLongestOfflineStreak(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return null;
    // Build set of active days
    const activeDays = new Set();
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            activeDays.add(new Date(onlineAt * 1000).toISOString().slice(0, 10));
            onlineAt = null;
        }
    }
    if (activeDays.size === 0)
        return null;
    const sorted = [...activeDays].sort();
    const start = new Date(sorted[0] + "T00:00:00");
    const end = new Date(sorted[sorted.length - 1] + "T00:00:00");
    let maxGap = 0, gap = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (activeDays.has(key)) {
            maxGap = Math.max(maxGap, gap);
            gap = 0;
        }
        else
            gap++;
    }
    return maxGap > 0 ? maxGap : null;
}
function computeDailyAvgOnline(entries) {
    const byDay = buildDailySeconds(entries);
    const days = Object.values(byDay);
    if (days.length === 0)
        return { avgOnlineSec: null, trendPct: null };
    const avgOnlineSec = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    const sorted = Object.keys(byDay).sort();
    let trendPct = null;
    if (sorted.length >= 14) {
        const recent = sorted.slice(-7).reduce((s, d) => s + byDay[d], 0) / 7;
        const prev = sorted.slice(-14, -7).reduce((s, d) => s + byDay[d], 0) / 7;
        if (prev > 0)
            trendPct = Math.round(((recent - prev) / prev) * 100);
    }
    return { avgOnlineSec, trendPct };
}
function buildDailySeconds(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    const byDay = {};
    let onlineAt = null;
    const add = (start, end) => {
        let cur = start;
        while (cur < end) {
            const date = new Date(cur * 1000).toISOString().slice(0, 10);
            const d = new Date(cur * 1000);
            d.setHours(24, 0, 0, 0);
            const sliceEnd = Math.min(end, Math.floor(d.getTime() / 1000));
            byDay[date] = (byDay[date] ?? 0) + (sliceEnd - cur);
            cur = sliceEnd;
        }
    };
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            add(onlineAt, p.at);
            onlineAt = null;
        }
    }
    if (onlineAt != null)
        add(onlineAt, Math.floor(Date.now() / 1000));
    return byDay;
}
function computeNightOwlScore(entries) {
    const buckets = new Array(24).fill(0);
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    let onlineAt = null;
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            distributeToHours(buckets, onlineAt, p.at);
            onlineAt = null;
        }
    }
    if (onlineAt != null)
        distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
    const total = buckets.reduce((a, b) => a + b, 0);
    if (total === 0)
        return null;
    const nightTime = buckets.slice(0, 5).reduce((a, b) => a + b, 0); // midnight–5am
    return Math.round((nightTime / total) * 100);
}
function computeConsistencyScore(entries) {
    const byDay = buildDailySeconds(entries);
    const vals = Object.values(byDay);
    if (vals.length < 3)
        return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean === 0)
        return null;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    const cv = std / mean; // 0 = perfectly consistent, higher = erratic
    return Math.max(0, Math.round(100 - cv * 100));
}
function computeMessageFrequency(entries) {
    const byDate = {};
    for (const e of entries) {
        if (e.kind !== "message")
            continue;
        const date = new Date(e.at * 1000).toISOString().slice(0, 10);
        if (!byDate[date])
            byDate[date] = { sent: 0, received: 0 };
        if (e.isFromMe)
            byDate[date].sent++;
        else
            byDate[date].received++;
    }
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date: date.slice(5), ...v }));
}
function computeMsgPerDay(entries) {
    const byDate = {};
    for (const e of entries) {
        if (e.kind !== "message")
            continue;
        const date = new Date(e.at * 1000).toISOString().slice(0, 10);
        if (!byDate[date])
            byDate[date] = { sent: 0, received: 0 };
        if (e.isFromMe)
            byDate[date].sent++;
        else
            byDate[date].received++;
    }
    const days = Object.values(byDate);
    if (days.length === 0)
        return { sentPerDay: null, receivedPerDay: null };
    return {
        sentPerDay: days.reduce((s, d) => s + d.sent, 0) / days.length,
        receivedPerDay: days.reduce((s, d) => s + d.received, 0) / days.length,
    };
}
function computeConversationStats(entries) {
    const CONV_GAP = 3600; // 1 hour gap = new conversation
    const messages = entries.filter((e) => e.kind === "message").sort((a, b) => a.at - b.at);
    if (messages.length === 0)
        return { ghostRate: null, initiatorPct: null, avgConvLen: null, doubleTextPct: null };
    const convs = [];
    let cur = null;
    for (const m of messages) {
        if (!cur || m.at - cur.messages[cur.messages.length - 1].at > CONV_GAP) {
            cur = { messages: [m], initiator: m.isFromMe ? "me" : "them" };
            convs.push(cur);
        }
        else {
            cur.messages.push(m);
        }
    }
    // Ghost rate: they initiated and we never replied
    const themInit = convs.filter((c) => c.initiator === "them");
    const ghosted = themInit.filter((c) => !c.messages.some((m) => m.isFromMe));
    const ghostRate = themInit.length > 0 ? Math.round((ghosted.length / themInit.length) * 100) : null;
    // Initiator %: % of convs I started
    const initiatorPct = convs.length > 0 ? Math.round((convs.filter((c) => c.initiator === "me").length / convs.length) * 100) : null;
    // Avg conversation length
    const avgConvLen = convs.length > 0 ? Math.round(convs.reduce((s, c) => s + c.messages.length, 0) / convs.length) : null;
    // Double-text: they send 2+ consecutive within 5 min
    let doubleTexts = 0, theirTurns = 0;
    for (const c of convs) {
        let i = 0;
        while (i < c.messages.length) {
            if (!c.messages[i].isFromMe) {
                theirTurns++;
                let j = i + 1;
                while (j < c.messages.length && !c.messages[j].isFromMe && c.messages[j].at - c.messages[j - 1].at < 300)
                    j++;
                if (j - i > 1)
                    doubleTexts++;
                i = j;
            }
            else
                i++;
        }
    }
    const doubleTextPct = theirTurns > 0 ? Math.round((doubleTexts / theirTurns) * 100) : null;
    return { ghostRate, initiatorPct, avgConvLen, doubleTextPct };
}
function computeMediaRatio(entries) {
    const msgs = entries.filter((e) => e.kind === "message");
    if (msgs.length === 0)
        return null;
    const media = msgs.filter((e) => e.mediaType && e.mediaType !== "");
    return Math.round((media.length / msgs.length) * 100);
}
function computePicChangeFrequency(entries) {
    const pics = entries.filter((e) => e.kind === "picture").sort((a, b) => a.at - b.at);
    if (pics.length < 2)
        return null;
    const span = (pics[pics.length - 1].at - pics[0].at) / 86400;
    return Math.round(span / (pics.length - 1));
}
function computeFirstLastSeen(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return { firstSeen: null, lastSeen: null };
    return { firstSeen: presence[0].at, lastSeen: presence[presence.length - 1].at };
}
function computeSleepWindow(entries) {
    // For each day find the longest offline gap. Average the start-hour of those gaps.
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return null;
    // Build offline gaps
    const gaps = [];
    for (let i = 1; i < presence.length; i++) {
        if (presence[i - 1].state === "unavailable" && presence[i].state === "available") {
            gaps.push({ start: presence[i - 1].at, end: presence[i].at });
        }
    }
    // Filter to gaps > 3h that span through night hours (8pm–10am)
    const nightGaps = gaps.filter((g) => {
        const dur = g.end - g.start;
        if (dur < 3 * 3600)
            return false;
        const startH = new Date(g.start * 1000).getHours();
        // Starts in evening or night: 20-24 or 0-4
        return startH >= 20 || startH <= 4;
    });
    if (nightGaps.length < 3)
        return null;
    // Circular mean of start hours and end hours
    const toRad = (h, m) => ((h + m / 60) / 24) * 2 * Math.PI;
    const circMean = (angles) => {
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
    const avgEnd = circMean(endAngles);
    const fmt = (h) => {
        const hr = Math.floor(h) % 24;
        const suffix = hr < 12 ? "am" : "pm";
        return `${hr % 12 === 0 ? 12 : hr % 12}${suffix}`;
    };
    return `${fmt(avgStart)} – ${fmt(avgEnd)}`;
}
function computeOnlinePatternSummary(hourlyData) {
    const threshold = Math.max(...hourlyData.map((d) => d.minutes)) * 0.5;
    if (threshold === 0)
        return null;
    const active = hourlyData.map((d, i) => ({ i, m: d.minutes })).filter((d) => d.m >= threshold).map((d) => d.i);
    if (active.length === 0)
        return null;
    const fmt = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
    return `${fmt(active[0])} – ${fmt(active[active.length - 1])}`;
}
function computeTrend30Days(entries) {
    const byDay = buildDailySeconds(entries);
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key.slice(5), minutes: Math.round((byDay[key] ?? 0) / 60) });
    }
    return result;
}
function computeMsgHourActivity(entries) {
    const buckets = new Array(24).fill(0);
    for (const e of entries) {
        if (e.kind !== "message" || !e.isFromMe)
            continue;
        buckets[new Date(e.at * 1000).getHours()]++;
    }
    return buckets.map((count, i) => ({ hour: i.toString().padStart(2, "0"), count }));
}
function computeHeatmap(entries) {
    const byDay = buildDailySeconds(entries);
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 111; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, minutes: Math.round((byDay[key] ?? 0) / 60) });
    }
    return result;
}
// ---------------------------------------------------------------------------
// Export
function exportCSV(entries) {
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
    a.href = url;
    a.download = "contact-timeline.csv";
    a.click();
    URL.revokeObjectURL(url);
}
// ---------------------------------------------------------------------------
// Helpers
function formatDuration(sec) {
    if (sec < 60)
        return `${sec}s`;
    if (sec < 3600)
        return `${Math.round(sec / 60)}m`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatDate(unix) {
    return new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function formatDatetime(unix) {
    return new Date(unix * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
