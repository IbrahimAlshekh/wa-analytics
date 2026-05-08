import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
function getInitials(name) {
    if (name.startsWith("+"))
        return name.slice(1, 3);
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
export default function ContactList({ accountId }) {
    const qc = useQueryClient();
    const contacts = useQuery({
        queryKey: ["contacts", accountId],
        queryFn: () => api.listContacts(accountId),
    });
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const addMutation = useMutation({
        mutationFn: () => api.createContact(accountId, phone, name),
        onSuccess: () => {
            setPhone("");
            setName("");
            setError(null);
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["contacts", accountId] });
        },
        onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
    const toggle = useMutation({
        mutationFn: ({ id, enabled }) => api.updateContact(accountId, id, { trackingEnabled: enabled }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", accountId] }),
    });
    const remove = useMutation({
        mutationFn: (id) => api.deleteContact(accountId, id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", accountId] }),
    });
    return (_jsxs("div", { className: "col", style: { gap: 20 }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }, children: "Contacts" }), _jsx("button", { className: showForm ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm", onClick: () => { setShowForm((v) => !v); setError(null); }, children: showForm ? "Cancel" : "+ Add contact" })] }), showForm && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { marginBottom: 14, fontSize: 14, fontWeight: 600 }, children: "Add a contact to track" }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); addMutation.mutate(); }, style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [_jsx("input", { className: "input", placeholder: "+14155551234", value: phone, onChange: (e) => setPhone(e.target.value), style: { flex: "1 1 160px" } }), _jsx("input", { className: "input", placeholder: "Display name (optional)", value: name, onChange: (e) => setName(e.target.value), style: { flex: "2 1 200px" } }), _jsx("button", { className: "btn btn-primary", type: "submit", disabled: !phone || addMutation.isPending, children: addMutation.isPending ? "Adding…" : "Add" })] }), error && _jsx("div", { className: "error", style: { marginTop: 10 }, children: error })] })), _jsx("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: _jsxs("table", { className: "contact-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { width: 40 } }), _jsx("th", { children: "Contact" }), _jsx("th", { children: "About" }), _jsx("th", { style: { width: 80 }, children: "Tracking" }), _jsx("th", { style: { width: 80 } })] }) }), _jsxs("tbody", { children: [(contacts.data ?? []).map((c) => (_jsx(ContactRow, { accountId: accountId, contact: c, onToggle: (enabled) => toggle.mutate({ id: c.id, enabled }), onDelete: () => {
                                        if (confirm(`Stop tracking ${c.displayName || c.phone}?`)) {
                                            remove.mutate(c.id);
                                        }
                                    } }, c.id))), contacts.data && contacts.data.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, children: _jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state-icon", children: "\uD83D\uDC64" }), _jsx("div", { style: { fontWeight: 500 }, children: "No contacts yet" }), _jsx("div", { className: "muted", children: "Add a contact above to start tracking" })] }) }) }))] })] }) })] }));
}
function ContactRow({ accountId, contact, onToggle, onDelete, }) {
    const timeline = useQuery({
        queryKey: ["timeline", accountId, contact.id],
        queryFn: () => api.timeline(accountId, contact.id, 0),
        refetchInterval: 60_000,
    });
    const entries = timeline.data?.entries ?? [];
    const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
    const lastAbout = [...entries].reverse().find((e) => e.kind === "about");
    const online = lastPresence?.state === "available";
    const displayName = contact.displayName || contact.phone;
    return (_jsxs("tr", { children: [_jsx("td", { style: { paddingLeft: 16 }, children: _jsxs("div", { className: "avatar avatar-sm", style: { position: "relative" }, children: [getInitials(displayName), _jsx("span", { className: `dot ${online ? "online" : ""}`, style: {
                                position: "absolute",
                                bottom: -1,
                                right: -1,
                                width: 9,
                                height: 9,
                                border: "2px solid var(--card)",
                            } })] }) }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [_jsx(Link, { to: `/accounts/${accountId}/contacts/${contact.id}`, style: { fontWeight: 600, color: "var(--fg)", fontSize: 13 }, children: displayName }), _jsxs("span", { className: "muted", style: { fontSize: 11 }, children: [contact.phone, lastPresence && (_jsxs(_Fragment, { children: [" \u00B7 ", online ? "Online now" : lastPresence.lastSeen
                                            ? `Last seen ${formatRelative(lastPresence.lastSeen)}`
                                            : `Offline ${formatRelative(lastPresence.at)}`] }))] })] }) }), _jsx("td", { children: _jsx("div", { style: { maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--fg-muted)" }, children: lastAbout?.text || _jsx("span", { className: "muted", children: "\u2014" }) }) }), _jsx("td", { children: _jsxs("label", { className: "toggle", title: contact.trackingEnabled ? "Tracking on" : "Tracking off", children: [_jsx("input", { type: "checkbox", checked: contact.trackingEnabled, onChange: (e) => onToggle(e.target.checked) }), _jsx("span", { className: "toggle-track" })] }) }), _jsx("td", { style: { paddingRight: 16 }, children: _jsx("button", { className: "btn btn-danger btn-sm", onClick: onDelete, children: "Remove" }) })] }));
}
function formatRelative(unix) {
    const now = Date.now() / 1000;
    const diff = Math.max(0, now - unix);
    if (diff < 60)
        return `${Math.floor(diff)}s ago`;
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
