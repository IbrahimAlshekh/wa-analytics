import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
export default function InsightsPanel({ entries }) {
    const hourlyData = computePeakHours(entries);
    if (!hourlyData.some((d) => d.minutes > 0)) {
        return null;
    }
    return (_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Peak Activity Hours" }), _jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes by hour of day" }), _jsx("div", { style: { width: "100%", height: 220 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: hourlyData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "hour" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] }));
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
        // Seconds remaining in this clock-hour
        const nextHourBoundary = Math.floor(cur / 3600) * 3600 + 3600;
        const sliceEnd = Math.min(end, nextHourBoundary);
        buckets[hour] += sliceEnd - cur;
        cur = sliceEnd;
    }
}
