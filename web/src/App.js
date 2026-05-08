import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { Link, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "./lib/ws";
import Accounts from "./pages/Accounts";
import Dashboard from "./pages/Dashboard";
import ContactDetail from "./pages/ContactDetail";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
export default function App() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        const token = localStorage.getItem("wt_bearer");
        if (!token && location.pathname !== "/login") {
            navigate("/login");
        }
    }, [location, navigate]);
    useEffect(() => {
        ws.start();
        const off = ws.on((msg) => {
            switch (msg.type) {
                case "auth.linked":
                case "auth.logout":
                    qc.invalidateQueries({ queryKey: ["accounts"] });
                    break;
                case "presence": {
                    const { accountId, contactId } = msg;
                    qc.invalidateQueries({ queryKey: ["contacts", accountId] });
                    qc.invalidateQueries({ queryKey: ["timeline", accountId, contactId] });
                    break;
                }
                case "picture":
                case "about": {
                    qc.invalidateQueries({ queryKey: ["timeline"] });
                    break;
                }
                case "message": {
                    const { accountId, contactId } = msg;
                    if (contactId != null) {
                        qc.invalidateQueries({ queryKey: ["messages", accountId, contactId] });
                        qc.invalidateQueries({ queryKey: ["timeline", accountId, contactId] });
                        qc.invalidateQueries({ queryKey: ["contacts", accountId] });
                    }
                    break;
                }
            }
        });
        return off;
    }, [qc]);
    const isLogin = location.pathname === "/login";
    const authed = Boolean(localStorage.getItem("wt_bearer"));
    return (_jsxs("div", { children: [_jsxs("header", { className: "app-bar", children: [_jsxs(Link, { to: "/", className: "app-logo", children: [_jsx("div", { className: "app-logo-mark", children: "W" }), !isLogin && _jsx("span", { children: "WA Tracker" })] }), _jsx("div", { className: "app-bar-fill" }), authed && (_jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => {
                            localStorage.removeItem("wt_bearer");
                            navigate("/login");
                        }, children: "Logout" }))] }), _jsx("div", { className: "container", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/", element: _jsx(Accounts, {}) }), _jsx(Route, { path: "/accounts/:id", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/accounts/:id/contacts/:cid", element: _jsx(ContactDetail, {}) }), _jsx(Route, { path: "/accounts/:id/contacts/:cid/messages", element: _jsx(Messages, {}) })] }) })] }));
}
