import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api";
import { ws } from "./lib/ws";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ContactDetail from "./pages/ContactDetail";
export default function App() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const status = useQuery({
        queryKey: ["status"],
        queryFn: api.status,
        refetchInterval: 30_000,
    });
    useEffect(() => {
        ws.start();
        const off = ws.on((msg) => {
            switch (msg.type) {
                case "auth.linked":
                    qc.invalidateQueries({ queryKey: ["status"] });
                    navigate("/");
                    break;
                case "auth.logout":
                    qc.invalidateQueries({ queryKey: ["status"] });
                    navigate("/login");
                    break;
                case "presence":
                    qc.setQueryData(["contacts"], (prev) => prev);
                    qc.invalidateQueries({ queryKey: ["contacts"] });
                    qc.invalidateQueries({ queryKey: ["timeline", msg.contactId] });
                    break;
                case "picture":
                case "about":
                    qc.invalidateQueries({ queryKey: ["timeline", msg.contactId] });
                    qc.invalidateQueries({ queryKey: ["contacts"] });
                    break;
            }
        });
        return off;
    }, [qc, navigate]);
    const linked = status.data?.linked;
    return (_jsxs("div", { className: "container", children: [_jsxs("header", { className: "header", children: [_jsx("div", { className: "title", children: "WhatsApp Tracker" }), _jsxs("div", { className: "row", children: [status.data?.linked && (_jsx("span", { className: "muted", children: status.data.ownJID })), status.data?.linked ? (_jsx("button", { className: "btn btn-danger", onClick: async () => {
                                    await api.logout();
                                    qc.invalidateQueries({ queryKey: ["status"] });
                                    navigate("/login");
                                }, children: "Logout" })) : null] })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: linked ? _jsx(Dashboard, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/login", element: linked ? _jsx(Navigate, { to: "/", replace: true }) : _jsx(Login, {}) }), _jsx(Route, { path: "/contacts/:id", element: linked ? _jsx(ContactDetail, {}) : _jsx(Navigate, { to: "/login", replace: true }) })] })] }));
}
