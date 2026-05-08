import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";
export default function Accounts() {
    const qc = useQueryClient();
    const accounts = useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
    const [showPair, setShowPair] = useState(false);
    const [pairTab, setPairTab] = useState("qr");
    const toggle = useMutation({
        mutationFn: ({ id, trackingActive }) => api.updateAccount(id, { trackingActive }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
    });
    const remove = useMutation({
        mutationFn: (id) => api.deleteAccount(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
    });
    const list = accounts.data ?? [];
    return (_jsxs("div", { className: "col", style: { gap: 20 }, children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }, children: "Linked accounts" }), _jsx("button", { className: showPair ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm", onClick: () => setShowPair((v) => !v), children: showPair ? "Cancel" : "+ Add account" })] }), showPair && (_jsxs("div", { className: "card", children: [_jsx("div", { style: { marginBottom: 14, fontSize: 14, fontWeight: 600 }, children: "Link a WhatsApp account" }), _jsxs("div", { className: "tabs", style: { marginBottom: 20, width: "fit-content" }, children: [_jsx("button", { className: "btn", "aria-current": pairTab === "qr", onClick: () => setPairTab("qr"), children: "QR code" }), _jsx("button", { className: "btn", "aria-current": pairTab === "phone", onClick: () => setPairTab("phone"), children: "Phone code" })] }), pairTab === "qr" ? _jsx(QRView, {}) : _jsx(PhoneCodeView, {})] })), list.length === 0 && !showPair && (_jsx("div", { className: "card", children: _jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state-icon", children: "\uD83D\uDCF1" }), _jsx("div", { style: { fontWeight: 500 }, children: "No accounts linked yet" }), _jsx("div", { className: "muted", children: "Click \"+ Add account\" to link your WhatsApp" })] }) })), list.length > 0 && (_jsx("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: _jsxs("table", { className: "contact-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { width: 40 } }), _jsx("th", { children: "Account" }), _jsx("th", { style: { width: 100 }, children: "Tracking" }), _jsx("th", { style: { width: 80 } })] }) }), _jsx("tbody", { children: list.map((acc) => (_jsx(AccountRow, { account: acc, onToggle: (v) => toggle.mutate({ id: acc.id, trackingActive: v }), onDelete: () => {
                                    if (confirm(`Remove account ${acc.label || acc.jid}?`))
                                        remove.mutate(acc.id);
                                } }, acc.id))) })] }) }))] }));
}
function AccountRow({ account, onToggle, onDelete, }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(account.label);
    const saveLabel = useMutation({
        mutationFn: () => api.updateAccount(account.id, { label }),
        onSuccess: () => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["accounts"] });
        },
    });
    const initials = (account.label || account.jid || "?").slice(0, 2).toUpperCase();
    return (_jsxs("tr", { children: [_jsx("td", { style: { paddingLeft: 16 }, children: _jsxs("div", { className: "avatar avatar-sm", style: {
                        background: account.connected ? "var(--accent-dim)" : "rgba(148,163,184,0.15)",
                        color: account.connected ? "var(--accent)" : "var(--fg-muted)",
                        position: "relative",
                    }, children: [initials, _jsx("span", { className: `dot ${account.connected ? "online" : ""}`, style: { position: "absolute", bottom: -1, right: -1, width: 9, height: 9, border: "2px solid var(--card)" } })] }) }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [_jsx(Link, { to: `/accounts/${account.id}`, style: { fontWeight: 600, color: "var(--fg)", fontSize: 13 }, children: account.label || account.jid }), editing ? (_jsxs("div", { className: "row", style: { gap: 6, marginTop: 4 }, children: [_jsx("input", { className: "input", style: { width: 160, padding: "4px 8px", fontSize: 12 }, value: label, onChange: (e) => setLabel(e.target.value), autoFocus: true }), _jsx("button", { className: "btn btn-primary btn-sm", onClick: () => saveLabel.mutate(), children: "Save" }), _jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => { setLabel(account.label); setEditing(false); }, children: "Cancel" })] })) : (_jsxs("span", { className: "muted", style: { fontSize: 11 }, children: [account.jid, _jsx("button", { className: "btn btn-ghost", style: { fontSize: 11, padding: "1px 6px", marginLeft: 4, height: "auto" }, onClick: () => setEditing(true), children: "rename" })] }))] }) }), _jsx("td", { children: _jsxs("label", { className: "toggle", title: account.trackingActive ? "Tracking on" : "Tracking off", children: [_jsx("input", { type: "checkbox", checked: account.trackingActive, onChange: (e) => onToggle(e.target.checked) }), _jsx("span", { className: "toggle-track" })] }) }), _jsx("td", { style: { paddingRight: 16 }, children: _jsx("button", { className: "btn btn-danger btn-sm", onClick: onDelete, children: "Remove" }) })] }));
}
