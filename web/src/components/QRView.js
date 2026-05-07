import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../lib/api";
import { ws } from "../lib/ws";
export default function QRView() {
    const [code, setCode] = useState(null);
    const [error, setError] = useState(null);
    const [starting, setStarting] = useState(false);
    async function start() {
        setError(null);
        setStarting(true);
        try {
            await api.startQR();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setStarting(false);
        }
    }
    useEffect(() => {
        const off = ws.on((msg) => {
            if (msg.type === "auth.qr")
                setCode(msg.code);
        });
        return off;
    }, []);
    return (_jsxs("div", { className: "col", style: { alignItems: "center" }, children: [_jsx("p", { className: "muted", children: "Open WhatsApp on your phone \u2192 Linked devices \u2192 Link a device." }), code ? (_jsx("div", { className: "qr", children: _jsx(QRCodeSVG, { value: code, size: 232, level: "M" }) })) : (_jsx("div", { className: "qr", style: { width: 264, height: 264 } })), _jsx("button", { className: "btn btn-primary", onClick: start, disabled: starting, children: code ? "Refresh" : "Generate QR" }), error && _jsx("div", { className: "error", children: error })] }));
}
