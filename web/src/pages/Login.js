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
    return (_jsx("div", { style: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "70vh",
        }, children: _jsxs("div", { className: "card", style: { width: 320 }, children: [_jsx("h2", { style: { marginTop: 0 }, children: "Login" }), _jsxs("form", { onSubmit: handleSubmit, className: "col", style: { gap: 12 }, children: [_jsx("input", { className: "input", placeholder: "Username", value: username, onChange: (e) => setUsername(e.target.value), required: true }), _jsx("input", { className: "input", type: "password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), required: true }), _jsx("button", { className: "btn btn-primary", type: "submit", disabled: loading, children: loading ? "Logging in..." : "Login" })] }), error && _jsx("div", { className: "error", style: { marginTop: 12 }, children: error })] }) }));
}
