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
    return (_jsx("div", { className: "col", style: { gap: 16 }, children: _jsxs("div", { className: "card", children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", marginBottom: 12 }, children: [_jsx("h2", { style: { margin: 0 }, children: "Linked accounts" }), _jsx("button", { className: "btn btn-primary", onClick: () => setShowPair((v) => !v), children: showPair ? "Cancel" : "+ Add account" })] }), showPair && (_jsxs("div", { style: { borderTop: "1px solid var(--border)", paddingTop: 16 }, children: [_jsxs("div", { className: "tabs", children: [_jsx("button", { className: "btn", "aria-current": pairTab === "qr", onClick: () => setPairTab("qr"), children: "QR code" }), _jsx("button", { className: "btn", "aria-current": pairTab === "phone", onClick: () => setPairTab("phone"), children: "Phone code" })] }), pairTab === "qr" ? _jsx(QRView, {}) : _jsx(PhoneCodeView, {})] })), list.length === 0 && !showPair && (_jsx("p", { className: "muted", children: "No accounts linked yet. Click \"Add account\" to get started." })), list.length > 0 && (_jsxs("table", { className: "contact-table", style: { marginTop: showPair ? 16 : 0 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", {}), _jsx("th", { children: "Number / Label" }), _jsx("th", { children: "Tracking" }), _jsx("th", {})] }) }), _jsx("tbody", { children: list.map((acc) => (_jsx(AccountRow, { account: acc, onToggle: (v) => toggle.mutate({ id: acc.id, trackingActive: v }), onDelete: () => {
                                    if (confirm(`Remove account ${acc.label || acc.jid}?`))
                                        remove.mutate(acc.id);
                                } }, acc.id))) })] }))] }) }));
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
    return (_jsxs("tr", { children: [_jsx("td", { children: _jsx("span", { className: "dot", style: {
                        background: account.connected
                            ? "var(--accent)"
                            : "var(--offline)",
                    }, title: account.connected ? "Connected" : "Disconnected" }) }), _jsxs("td", { children: [_jsx("div", { children: _jsx(Link, { to: `/accounts/${account.id}`, style: { fontWeight: 500 }, children: account.label || account.jid }) }), editing ? (_jsxs("div", { className: "row", style: { gap: 6, marginTop: 4 }, children: [_jsx("input", { className: "input", style: { width: 160 }, value: label, onChange: (e) => setLabel(e.target.value), autoFocus: true }), _jsx("button", { className: "btn btn-primary", style: { padding: "4px 10px" }, onClick: () => saveLabel.mutate(), children: "Save" }), _jsx("button", { className: "btn", style: { padding: "4px 10px" }, onClick: () => {
                                    setLabel(account.label);
                                    setEditing(false);
                                }, children: "Cancel" })] })) : (_jsxs("div", { className: "muted", style: { fontSize: 11 }, children: [account.jid, _jsx("button", { className: "btn", style: { fontSize: 11, padding: "1px 6px", marginLeft: 6 }, onClick: () => setEditing(true), children: "rename" })] }))] }), _jsx("td", { children: _jsxs("label", { className: "row", style: { gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: account.trackingActive, onChange: (e) => onToggle(e.target.checked) }), _jsx("span", { className: "muted", children: account.trackingActive ? "On" : "Off" })] }) }), _jsx("td", { children: _jsx("button", { className: "btn btn-danger", onClick: onDelete, children: "Remove" }) })] }));
}
