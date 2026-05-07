import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../lib/api";
export default function PhoneCodeView() {
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function submit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await api.pairPhone(phone);
            setCode(res.code);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "col", children: [_jsx("p", { className: "muted", children: "Enter your phone in international format (e.g. +14155551234). Then in WhatsApp: Linked devices \u2192 Link a device \u2192 Link with phone number instead." }), _jsx("input", { className: "input", placeholder: "+14155551234", value: phone, onChange: (e) => setPhone(e.target.value) }), _jsx("button", { className: "btn btn-primary", type: "submit", disabled: !phone || loading, children: loading ? "Generating…" : "Get pairing code" }), code && (_jsxs("div", { className: "col", style: { alignItems: "center", marginTop: 16 }, children: [_jsx("span", { className: "muted", children: "Enter this code on your phone:" }), _jsx("span", { className: "code", children: code.match(/.{1,4}/g)?.join(" ") ?? code })] })), error && _jsx("div", { className: "error", children: error })] }));
}
