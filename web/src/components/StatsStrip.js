import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { api } from "../lib/api";
export default function StatsStrip({ accountId, contactId }) {
    const [range, setRange] = useState("week");
    const stats = useQuery({
        queryKey: ["stats", accountId, contactId, range],
        queryFn: () => api.stats(accountId, contactId, range),
        refetchInterval: 60_000,
    });
    const data = stats.data?.days.map((d) => ({
        date: d.date.slice(5),
        minutes: Math.round(d.onlineSeconds / 60),
    })) ?? [];
    return (_jsxs("div", { className: "col", style: { gap: 12 }, children: [_jsx("div", { style: { display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }, children: _jsxs("div", { className: "card", style: { flex: "1 1 420px", padding: "14px 16px" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }, children: "Online time" }), _jsx("div", { className: "tabs", children: ["today", "week", "month"].map((r) => (_jsx("button", { className: "btn", "aria-current": range === r, onClick: () => setRange(r), children: r.charAt(0).toUpperCase() + r.slice(1) }, r))) })] }), _jsxs("div", { className: "stats", style: { marginBottom: 0 }, children: [_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "Online time" }), _jsx("div", { className: "value", children: formatDuration(stats.data?.onlineSecondsAll ?? 0) })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "Pic changes" }), _jsx("div", { className: "value", children: stats.data?.pictureChanges ?? 0 })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "About changes" }), _jsx("div", { className: "value", children: stats.data?.aboutChanges ?? 0 })] })] })] }) }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { fontSize: 12, color: "var(--fg-muted)", fontWeight: 500, marginBottom: 12 }, children: "Online minutes per day" }), _jsx("div", { style: { width: "100%", height: 200 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: data, barCategoryGap: "30%", children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.1)", vertical: false }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 11, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fontSize: 11, fill: "var(--fg-muted)" }, axisLine: false, tickLine: false, width: 32 }), _jsx(Tooltip, { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, cursor: { fill: "var(--accent-dim)" } }), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)", radius: [4, 4, 0, 0] })] }) }) })] })] }));
}
function formatDuration(secs) {
    if (secs < 60)
        return `${secs}s`;
    if (secs < 3600)
        return `${Math.round(secs / 60)}m`;
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return `${h}h ${m}m`;
}
