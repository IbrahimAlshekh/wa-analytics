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
    return (_jsxs("div", { className: "col", style: { gap: 8 }, children: [_jsx("div", { className: "row", style: { justifyContent: "space-between" }, children: _jsx("div", { className: "tabs", children: ["today", "week", "month"].map((r) => (_jsx("button", { className: "btn", "aria-current": range === r, onClick: () => setRange(r), children: r }, r))) }) }), _jsxs("div", { className: "stats", children: [_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "Online time" }), _jsx("div", { className: "value", children: formatDuration(stats.data?.onlineSecondsAll ?? 0) })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "Picture changes" }), _jsx("div", { className: "value", children: stats.data?.pictureChanges ?? 0 })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "label", children: "About changes" }), _jsx("div", { className: "value", children: stats.data?.aboutChanges ?? 0 })] })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "muted", style: { marginBottom: 8 }, children: "Online minutes per day" }), _jsx("div", { style: { width: "100%", height: 220 }, children: _jsx(ResponsiveContainer, { children: _jsxs(BarChart, { data: data, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "rgba(127,127,127,0.2)" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "minutes", fill: "var(--accent)" })] }) }) })] })] }));
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
