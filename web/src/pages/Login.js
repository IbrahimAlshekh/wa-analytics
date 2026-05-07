import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";
export default function Login() {
    const [tab, setTab] = useState("qr");
    return (_jsxs("div", { className: "card", style: { maxWidth: 480, margin: "0 auto" }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "Link your WhatsApp" }), _jsxs("div", { className: "tabs", children: [_jsx("button", { className: "btn", "aria-current": tab === "qr", onClick: () => setTab("qr"), children: "QR code" }), _jsx("button", { className: "btn", "aria-current": tab === "phone", onClick: () => setTab("phone"), children: "Phone code" })] }), tab === "qr" ? _jsx(QRView, {}) : _jsx(PhoneCodeView, {})] }));
}
