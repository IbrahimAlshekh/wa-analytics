import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
export default function ContactDetail() {
    const { id: accountIdStr, cid: cidStr } = useParams();
    const accountId = Number(accountIdStr);
    const cid = Number(cidStr);
    const tl = useQuery({
        queryKey: ["timeline", accountId, cid],
        queryFn: () => api.timeline(accountId, cid, 0),
        refetchInterval: 30_000,
    });
    if (tl.isLoading)
        return _jsx("div", { className: "muted", children: "Loading\u2026" });
    if (tl.error)
        return _jsx("div", { className: "error", children: tl.error.message });
    if (!tl.data)
        return null;
    const { contact, entries } = tl.data;
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsx(Link, { to: `/accounts/${accountId}`, className: "muted", children: "\u2190 back" }), _jsx("h2", { style: { margin: "4px 0 0" }, children: contact.displayName || contact.phone }), _jsx("span", { className: "muted", children: contact.phone })] }), _jsxs("div", { className: "row", style: { gap: 8, alignItems: "center" }, children: [_jsx("span", { className: "tag", children: contact.trackingEnabled ? "Tracking" : "Paused" }), _jsx(Link, { to: `/accounts/${accountId}/contacts/${cid}/messages`, className: "btn", children: "Messages" })] })] }), _jsx(StatsStrip, { accountId: accountId, contactId: cid }), _jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Activity timeline" }), _jsx(SessionTimeline, { entries: entries })] })] }));
}
