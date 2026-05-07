import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
export default function InsightsPanel({ entries }) {
    const hourlyData = computePeakHours(entries);
    const weekdayData = computeWeekdayActivity(entries);
    const avgSession = computeAvgSessionDuration(entries);
    const avgResponseTime = computeAvgResponseTime(entries);
    const hasPresence = hourlyData.some((d) => d.minutes > 0);
    if (!hasPresence) {
        return null;
    }
    const statCards = [
        avgSession != null && { label: "Avg session duration", value: formatDuration(avgSession) },
        avgResponseTime != null && { label: "Avg response time", value: formatDuration(avgResponseTime) },
    ].filter(Boolean);
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [statCards.length > 0 && (_jsx("div", { className: "stats", children: statCards.map((c) => (_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: c.label }), _jsx("div", { className: "value", children: c.value })] }, c.label))) })), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Peak Activity Hours" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by hour of day" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: hourlyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "hour" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Most Active Days" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by day of week" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: weekdayData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "day" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] })] })] }));
}
function computePeakHours(entries) {
    const buckets = new Array(24).fill(0); // seconds per hour
    const presence = entries
        .filter((e) => e.kind === "presence")
        .sort((a, b) => a.at - b.at);
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
    // If still online, count up to now
    if (onlineAt != null) {
        distributeToHours(buckets, onlineAt, Math.floor(Date.now() / 1000));
    }
    return buckets.map((sec, i) => ({
        hour: `${i.toString().padStart(2, "0")}`,
        minutes: Math.round(sec / 60),
    }));
}
function distributeToHours(buckets, start, end) {
    let cur = start;
    while (cur < end) {
        const d = new Date(cur * 1000);
        const hour = d.getHours();
        const nextHourBoundary = Math.floor(cur / 3600) * 3600 + 3600;
        const sliceEnd = Math.min(end, nextHourBoundary);
        buckets[hour] += sliceEnd - cur;
        cur = sliceEnd;
    }
}
// Returns average session duration in seconds, or null if no complete sessions.
function computeAvgSessionDuration(entries) {
    const presence = entries
        .filter((e) => e.kind === "presence")
        .sort((a, b) => a.at - b.at);
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function computeWeekdayActivity(entries) {
    const buckets = new Array(7).fill(0); // seconds per weekday index
    const presence = entries
        .filter((e) => e.kind === "presence")
        .sort((a, b) => a.at - b.at);
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
    if (onlineAt != null) {
        distributeToWeekdays(buckets, onlineAt, Math.floor(Date.now() / 1000));
    }
    // Reorder so Monday is first (index 1 → 6, then 0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => ({
        day: WEEKDAYS[i],
        minutes: Math.round(buckets[i] / 60),
    }));
}
function distributeToWeekdays(buckets, start, end) {
    let cur = start;
    while (cur < end) {
        const d = new Date(cur * 1000);
        const dow = d.getDay();
        // Next midnight boundary
        const next = new Date(d);
        next.setHours(24, 0, 0, 0);
        const nextBoundary = Math.floor(next.getTime() / 1000);
        const sliceEnd = Math.min(end, nextBoundary);
        buckets[dow] += sliceEnd - cur;
        cur = sliceEnd;
    }
}
// Returns average time (seconds) between receiving a message and the next sent reply.
function computeAvgResponseTime(entries) {
    const messages = entries
        .filter((e) => e.kind === "message")
        .sort((a, b) => a.at - b.at);
    const gaps = [];
    let lastReceivedAt = null;
    for (const m of messages) {
        if (!m.isFromMe) {
            lastReceivedAt = m.at;
        }
        else if (m.isFromMe && lastReceivedAt != null) {
            const gap = m.at - lastReceivedAt;
            // Only count gaps under 24h — larger gaps are likely not replies
            if (gap > 0 && gap < 86400) {
                gaps.push(gap);
            }
            lastReceivedAt = null;
        }
    }
    if (gaps.length === 0)
        return null;
    return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}
function formatDuration(sec) {
    if (sec < 60)
        return `${sec}s`;
    if (sec < 3600)
        return `${Math.round(sec / 60)}m`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
