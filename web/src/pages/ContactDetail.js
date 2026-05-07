import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Timeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
export default function ContactDetail() {
    const { id: idStr } = useParams();
    const id = Number(idStr);
    const tl = useQuery({
        queryKey: ["timeline", id],
        queryFn: () => api.timeline(id, 0),
        refetchInterval: 30_000,
    });
    if (tl.isLoading)
        return _jsx("div", { className: "muted", children: "Loading\u2026" });
    if (tl.error)
        return _jsx("div", { className: "error", children: tl.error.message });
    if (!tl.data)
        return null;
    const { contact, entries } = tl.data;
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsx(Link, { to: "/", className: "muted", children: "\u2190 back" }), _jsx("h2", { style: { margin: "4px 0 0" }, children: contact.displayName || contact.phone }), _jsx("span", { className: "muted", children: contact.phone })] }), _jsx("span", { className: "tag", children: contact.trackingEnabled ? "Tracking" : "Paused" })] }), _jsx(StatsStrip, { contactId: id }), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Timeline" }), _jsx(Timeline, { entries: entries })] })] }));
}
