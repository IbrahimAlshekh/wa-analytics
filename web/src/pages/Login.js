import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { token } = await api.login(username, password);
            localStorage.setItem("wt_bearer", token);
            navigate("/");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "login-wrap", children: _jsxs("div", { className: "login-box", children: [_jsxs("div", { className: "login-brand", children: [_jsx("div", { className: "login-brand-mark", children: "W" }), _jsx("div", { className: "login-brand-title", children: "WA Tracker" }), _jsx("div", { className: "login-brand-sub", children: "Sign in to your account" })] }), _jsxs("div", { className: "card", children: [_jsxs("form", { onSubmit: handleSubmit, className: "col", style: { gap: 14 }, children: [_jsxs("div", { className: "form-field", children: [_jsx("label", { className: "form-label", htmlFor: "login-user", children: "Username" }), _jsx("input", { id: "login-user", className: "input", placeholder: "username", value: username, onChange: (e) => setUsername(e.target.value), required: true, autoFocus: true, autoComplete: "username" })] }), _jsxs("div", { className: "form-field", children: [_jsx("label", { className: "form-label", htmlFor: "login-pass", children: "Password" }), _jsx("input", { id: "login-pass", className: "input", type: "password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), required: true, autoComplete: "current-password" })] }), _jsx("button", { className: "btn btn-primary", type: "submit", disabled: loading, style: { marginTop: 4 }, children: loading ? "Signing in…" : "Sign in" })] }), error && (_jsx("div", { className: "error", style: { marginTop: 12 }, children: error }))] })] }) }));
}
