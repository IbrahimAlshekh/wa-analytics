import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
export default function InsightsPanel({ entries }) {
    const hourlyData = computePeakHours(entries);
    const avgSession = computeAvgSessionDuration(entries);
    const hasPresence = hourlyData.some((d) => d.minutes > 0);
    if (!hasPresence) {
        return null;
    }
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [avgSession != null && (_jsx("div", { className: "stats", children: _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "Avg session duration" }), _jsx("div", { className: "value", children: formatDuration(avgSession) })] }) })), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Peak Activity Hours" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by hour of day" }), _jsx("div", { style: { width: "100%", height: 220 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: hourlyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "hour" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] })] }));
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
function formatDuration(sec) {
    if (sec < 60)
        return `${sec}s`;
    if (sec < 3600)
        return `${Math.round(sec / 60)}m`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
