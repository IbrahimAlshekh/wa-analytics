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
            qc.invalidateQueries({ queryKey: ["analytics", accountId, contactId] });
            qc.invalidateQueries({ queryKey: ["contacts", accountId] });
          }
          break;
        }
      }
    });
    return off;
  }, [qc]);

  const isLogin = location.pathname === "/login";
  const authed  = Boolean(localStorage.getItem("wt_bearer"));

  return (
    <div>
      <header className="app-bar">
        <Link to="/" className="app-logo">
          <div className="app-logo-mark">W</div>
          {!isLogin && <span>WA Tracker</span>}
        </Link>
        <div className="app-bar-fill" />
        {authed && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              localStorage.removeItem("wt_bearer");
              navigate("/login");
            }}
          >
            Logout
          </button>
        )}
      </header>
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Accounts />} />
          <Route path="/accounts/:id" element={<Dashboard />} />
          <Route path="/accounts/:id/contacts/:cid" element={<ContactDetail />} />
          <Route path="/accounts/:id/contacts/:cid/messages" element={<Messages />} />
        </Routes>
      </div>
    </div>
  );
}
