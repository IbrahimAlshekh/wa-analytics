import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
export default function ContactList() {
    const qc = useQueryClient();
    const contacts = useQuery({ queryKey: ["contacts"], queryFn: api.listContacts });
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState(null);
    const addMutation = useMutation({
        mutationFn: () => api.createContact(phone, name),
        onSuccess: () => {
            setPhone("");
            setName("");
            setError(null);
            qc.invalidateQueries({ queryKey: ["contacts"] });
        },
        onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
    const toggle = useMutation({
        mutationFn: ({ id, enabled }) => api.updateContact(id, { trackingEnabled: enabled }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
    });
    const remove = useMutation({
        mutationFn: (id) => api.deleteContact(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
    });
    return (_jsxs("div", { className: "col", style: { gap: 16 }, children: [_jsxs("div", { className: "card", children: [_jsx("h3", { style: { marginTop: 0 }, children: "Add contact" }), _jsxs("form", { onSubmit: (e) => {
                            e.preventDefault();
                            addMutation.mutate();
                        }, className: "row", style: { gap: 8 }, children: [_jsx("input", { className: "input", placeholder: "+14155551234", value: phone, onChange: (e) => setPhone(e.target.value) }), _jsx("input", { className: "input", placeholder: "Display name (optional)", value: name, onChange: (e) => setName(e.target.value) }), _jsx("button", { className: "btn btn-primary", type: "submit", disabled: !phone, children: "Add" })] }), error && _jsx("div", { className: "error", style: { marginTop: 8 }, children: error })] }), _jsx("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: _jsxs("table", { className: "contact-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", {}), _jsx("th", { children: "Name" }), _jsx("th", { children: "Phone" }), _jsx("th", { children: "About" }), _jsx("th", { children: "Tracking" }), _jsx("th", {})] }) }), _jsxs("tbody", { children: [(contacts.data ?? []).map((c) => (_jsx(ContactRow, { contact: c, onToggle: (enabled) => toggle.mutate({ id: c.id, enabled }), onDelete: () => {
                                        if (confirm(`Stop tracking ${c.displayName || c.phone}?`)) {
                                            remove.mutate(c.id);
                                        }
                                    } }, c.id))), contacts.data && contacts.data.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "muted", style: { padding: 24 }, children: "No contacts yet \u2014 add one above." }) }))] })] }) })] }));
}
function ContactRow({ contact, onToggle, onDelete, }) {
    const timeline = useQuery({
        queryKey: ["timeline", contact.id],
        queryFn: () => api.timeline(contact.id, 0),
        refetchInterval: 60_000,
    });
    const entries = timeline.data?.entries ?? [];
    const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
    const lastAbout = [...entries].reverse().find((e) => e.kind === "about");
    const lastPic = [...entries].reverse().find((e) => e.kind === "picture");
    const online = lastPresence?.state === "available";
    return (_jsxs("tr", { children: [_jsx("td", { children: _jsx("span", { className: `dot ${online ? "online" : ""}` }) }), _jsxs("td", { children: [_jsx(Link, { to: `/contacts/${contact.id}`, children: contact.displayName || contact.phone }), lastPresence && (_jsx("div", { className: "muted", style: { fontSize: 11 }, children: online
                            ? "Online now"
                            : lastPresence.lastSeen
                                ? `Last seen ${formatRelative(lastPresence.lastSeen)}`
                                : `Offline since ${formatRelative(lastPresence.at)}` }))] }), _jsx("td", { className: "muted", children: contact.phone }), _jsxs("td", { children: [_jsx("div", { style: { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: lastAbout?.text || _jsx("span", { className: "muted", children: "\u2014" }) }), lastPic?.url && (_jsxs("span", { className: "muted", style: { fontSize: 11 }, children: ["pic updated ", formatRelative(lastPic.at)] }))] }), _jsx("td", { children: _jsxs("label", { className: "row", style: { gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: contact.trackingEnabled, onChange: (e) => onToggle(e.target.checked) }), _jsx("span", { className: "muted", children: contact.trackingEnabled ? "On" : "Off" })] }) }), _jsx("td", { children: _jsx("button", { className: "btn btn-danger", onClick: onDelete, children: "Remove" }) })] }));
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
