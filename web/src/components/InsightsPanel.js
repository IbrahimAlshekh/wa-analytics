import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
export default function InsightsPanel({ entries }) {
    const hourlyData = computePeakHours(entries);
    const weekdayData = computeWeekdayActivity(entries);
    const msgFreqData = computeMessageFrequency(entries);
    const avgSession = computeAvgSessionDuration(entries);
    const avgResponseTime = computeAvgResponseTime(entries);
    const { sentPerDay, receivedPerDay } = computeMsgPerDay(entries);
    const patternSummary = computeOnlinePatternSummary(hourlyData);
    const streak = computeStreak(entries);
    const { avgOnlineSec, trendPct } = computeDailyAvgOnline(entries);
    const aboutHistory = entries
        .filter((e) => e.kind === "about")
        .sort((a, b) => b.at - a.at);
    const pictureHistory = entries
        .filter((e) => e.kind === "picture" && e.url)
        .sort((a, b) => b.at - a.at);
    const hasPresence = hourlyData.some((d) => d.minutes > 0);
    if (!hasPresence)
        return null;
    const statCards = [
        avgSession != null && { label: "Avg session duration", value: formatDuration(avgSession) },
        avgResponseTime != null && { label: "Avg response time", value: formatDuration(avgResponseTime) },
        sentPerDay != null && { label: "Msgs sent / day", value: sentPerDay.toFixed(1) },
        receivedPerDay != null && { label: "Msgs received / day", value: receivedPerDay.toFixed(1) },
        streak != null && {
            label: streak.online ? "Online streak" : "Offline for",
            value: streak.online ? `${streak.days}d` : formatDuration(streak.seconds),
        },
        avgOnlineSec != null && {
            label: "Daily avg online",
            value: formatDuration(avgOnlineSec) + (trendPct != null ? ` ${trendPct > 0 ? "▲" : "▼"}${Math.abs(trendPct)}%` : ""),
        },
    ].filter(Boolean);
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [statCards.length > 0 && (_jsx("div", { className: "stats", children: statCards.map((c) => (_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: c.label }), _jsx("div", { className: "value", children: c.value })] }, c.label))) })), patternSummary && (_jsx("div", { className: "card", children: _jsxs("span", { className: "muted", style: { fontSize: 13 }, children: ["Usually most active between", " ", _jsx("strong", { style: { color: "var(--accent)" }, children: patternSummary })] }) })), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Peak Activity Hours" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by hour of day" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: hourlyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "hour" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Most Active Days" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by day of week" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: weekdayData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "day" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] })] }), msgFreqData.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Message Frequency" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Messages per day (sent vs received)" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: msgFreqData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "sent", fill: "var(--accent)", name: "Sent" }), _jsx(Bar, { dataKey: "received", fill: "var(--offline)", name: "Received" })] }) }) })] })), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "About History" }), aboutHistory.length === 0 ? (_jsx("div", { className: "muted", children: "No about changes recorded." })) : (_jsx("div", { className: "col", style: { gap: 8, maxHeight: 220, overflowY: "auto" }, children: aboutHistory.map((e, i) => (_jsxs("div", { style: { borderBottom: "1px solid var(--border)", paddingBottom: 6 }, children: [_jsx("div", { className: "muted", style: { fontSize: 11, marginBottom: 2 }, children: formatDatetime(e.at) }), _jsx("div", { style: { fontSize: 13 }, children: e.text || _jsx("em", { className: "muted", children: "(empty)" }) })] }, i))) }))] }), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Profile Picture History" }), pictureHistory.length === 0 ? (_jsx("div", { className: "muted", children: "No profile pictures recorded." })) : (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }, children: pictureHistory.map((e, i) => (_jsxs("a", { href: e.url, target: "_blank", rel: "noreferrer", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }, children: [_jsx("img", { src: e.url, alt: formatDatetime(e.at), style: { width: 60, height: 60, objectFit: "cover", borderRadius: 8,
                                                border: "1px solid var(--border)" } }), _jsx("span", { className: "muted", style: { fontSize: 10 }, children: formatDate(e.at) })] }, i))) }))] })] })] }));
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
    return [1, 2, 3, 4, 5, 6, 0].map((i) => ({ day: WEEKDAYS[i], minutes: Math.round(buckets[i] / 60) }));
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
    if (durations.length === 0)
        return null;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
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
// #5: messages per day grouped by date
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
    return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
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
    const sentPerDay = days.reduce((s, d) => s + d.sent, 0) / days.length;
    const receivedPerDay = days.reduce((s, d) => s + d.received, 0) / days.length;
    return { sentPerDay, receivedPerDay };
}
// #8: human-readable peak window, e.g. "8pm – 11pm"
function computeOnlinePatternSummary(hourlyData) {
    const threshold = Math.max(...hourlyData.map((d) => d.minutes)) * 0.5;
    if (threshold === 0)
        return null;
    const activeHours = hourlyData
        .map((d, i) => ({ i, minutes: d.minutes }))
        .filter((d) => d.minutes >= threshold)
        .map((d) => d.i);
    if (activeHours.length === 0)
        return null;
    const fmt = (h) => {
        const suffix = h < 12 ? "am" : "pm";
        const display = h % 12 === 0 ? 12 : h % 12;
        return `${display}${suffix}`;
    };
    return `${fmt(activeHours[0])} – ${fmt(activeHours[activeHours.length - 1])}`;
}
// #9: online streak (consecutive days with activity) or offline duration
function computeStreak(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const last = presence[presence.length - 1];
    // Currently offline: show how long since last unavailable event
    if (last.state === "unavailable") {
        return { online: false, days: 0, seconds: nowSec - last.at };
    }
    // Currently online: count consecutive days with at least one session
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
// #10: daily average online time + trend vs previous 7 days
function computeDailyAvgOnline(entries) {
    const presence = entries.filter((e) => e.kind === "presence").sort((a, b) => a.at - b.at);
    if (presence.length === 0)
        return { avgOnlineSec: null, trendPct: null };
    const byDay = {};
    let onlineAt = null;
    const addSeconds = (start, end) => {
        let cur = start;
        while (cur < end) {
            const date = new Date(cur * 1000).toISOString().slice(0, 10);
            const d = new Date(cur * 1000);
            d.setHours(24, 0, 0, 0);
            const nextMidnight = Math.floor(d.getTime() / 1000);
            const sliceEnd = Math.min(end, nextMidnight);
            byDay[date] = (byDay[date] ?? 0) + (sliceEnd - cur);
            cur = sliceEnd;
        }
    };
    for (const p of presence) {
        if (p.state === "available") {
            onlineAt = p.at;
        }
        else if (p.state === "unavailable" && onlineAt != null) {
            addSeconds(onlineAt, p.at);
            onlineAt = null;
        }
    }
    if (onlineAt != null)
        addSeconds(onlineAt, Math.floor(Date.now() / 1000));
    const days = Object.values(byDay);
    if (days.length === 0)
        return { avgOnlineSec: null, trendPct: null };
    const avgOnlineSec = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    // Trend: last 7 days vs previous 7 days
    const sortedDates = Object.keys(byDay).sort();
    let trendPct = null;
    if (sortedDates.length >= 14) {
        const recent = sortedDates.slice(-7).reduce((s, d) => s + byDay[d], 0) / 7;
        const prev = sortedDates.slice(-14, -7).reduce((s, d) => s + byDay[d], 0) / 7;
        if (prev > 0)
            trendPct = Math.round(((recent - prev) / prev) * 100);
    }
    return { avgOnlineSec, trendPct };
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
    return new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatDatetime(unix) {
    return new Date(unix * 1000).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}
