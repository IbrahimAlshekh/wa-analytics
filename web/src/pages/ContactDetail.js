import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import SessionTimeline from "../components/Timeline";
import StatsStrip from "../components/StatsStrip";
import InsightsPanel from "../components/InsightsPanel";
function getInitials(name) {
    if (name.startsWith("+"))
        return name.slice(1, 3);
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
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
        return _jsx("div", { className: "muted", style: { padding: "48px 0", textAlign: "center" }, children: "Loading\u2026" });
    if (tl.error)
        return _jsx("div", { className: "error", children: tl.error.message });
    if (!tl.data)
        return null;
    const { contact, entries } = tl.data;
    const displayName = contact.displayName || contact.phone;
    const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
    const isOnline = lastPresence?.state === "available";
    return (_jsxs("div", { className: "col", style: { gap: 20 }, children: [_jsxs("div", { className: "breadcrumb", children: [_jsx(Link, { to: `/accounts/${accountId}`, children: "Contacts" }), _jsx("span", { className: "breadcrumb-sep", children: "/" }), _jsx("span", { children: displayName })] }), _jsxs("div", { className: "contact-hero", children: [_jsx("div", { className: "avatar avatar-lg", children: getInitials(displayName) }), _jsxs("div", { className: "contact-hero-info", children: [_jsx("div", { className: "contact-hero-name", children: displayName }), _jsx("div", { className: "contact-hero-phone", children: contact.phone }), _jsxs("div", { className: "row", style: { gap: 6 }, children: [_jsxs("span", { className: `badge ${isOnline ? "badge-online" : "badge-offline"}`, children: [_jsx("span", { className: `dot ${isOnline ? "online" : ""}`, style: { width: 6, height: 6 } }), isOnline ? "Online now" : "Offline"] }), _jsx("span", { className: `badge ${contact.trackingEnabled ? "badge-tracking" : "badge-paused"}`, children: contact.trackingEnabled ? "Tracking" : "Paused" })] })] }), _jsx("div", { className: "contact-hero-actions", children: _jsx(Link, { to: `/accounts/${accountId}/contacts/${cid}/messages`, className: "btn", children: "Messages" }) })] }), _jsx(StatsStrip, { accountId: accountId, contactId: cid }), _jsx(InsightsPanel, { entries: entries }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { marginBottom: 16 }, children: _jsx("span", { className: "section-label", children: "Activity Timeline" }) }), _jsx(SessionTimeline, { entries: entries })] })] }));
}
