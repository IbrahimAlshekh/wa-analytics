import { useEffect } from "react";
import { Link, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import logoSrc from "./assets/wa_analytics_logo_512.png";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "./lib/ws";
import { useStore } from "./lib/store";
import AccountLayout from "./components/AccountLayout";
import Accounts from "./pages/Accounts";
import ContactDetail from "./pages/ContactDetail";
import Messages from "./pages/Messages";
import Login from "./pages/Login";
import Register from "./pages/Register";

const publicPaths = ["/login", "/register"];

export default function App() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setToken, backupState, setBackupState, addWsEntry, setLastPresence } = useStore();

  useEffect(() => {
    if (!token && !publicPaths.includes(location.pathname)) {
      navigate("/login");
    }
  }, [location, navigate, token]);

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
          addWsEntry(accountId, contactId, {
            kind: "presence",
            at: msg.observedAt,
            state: msg.state,
            lastSeen: msg.lastSeen,
          });
          setLastPresence(accountId, contactId, msg.state, msg.observedAt, msg.lastSeen);
          qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
          qc.invalidateQueries({ queryKey: ["contacts", accountId] });
          qc.invalidateQueries({ queryKey: ["timeline", accountId, contactId] });
          break;
        }
        case "picture":
        case "about":
          qc.invalidateQueries({ queryKey: ["timeline"] });
          break;
        case "message": {
          const { accountId, contactId } = msg;
          if (contactId != null) {
            qc.invalidateQueries({ queryKey: ["messages", accountId, contactId] });
            qc.invalidateQueries({ queryKey: ["timeline", accountId, contactId] });
            qc.invalidateQueries({ queryKey: ["analytics", accountId, contactId] });
            qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
            qc.invalidateQueries({ queryKey: ["contacts", accountId] });
          }
          break;
        }
        case "history_sync": {
          const { accountId } = msg;
          // Messages page drives its own refetch via WS listener.
          // We only refresh ancillary data here.
          qc.invalidateQueries({ queryKey: ["timeline", accountId] });
          qc.invalidateQueries({ queryKey: ["analytics", accountId] });
          qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
          qc.invalidateQueries({ queryKey: ["contacts", accountId] });
          break;
        }
      }
    });
    return off;
  }, [qc]);

  async function triggerBackup() {
    if (backupState === "loading") return;
    setBackupState("loading");
    try {
      const res = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupState("idle");
    } catch {
      setBackupState("error");
      setTimeout(() => setBackupState("idle"), 3000);
    }
  }

  const isLogin = publicPaths.includes(location.pathname);
  const authed = Boolean(token);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="app-bar">
        <Link to="/" className="app-logo">
          <img src={logoSrc} className="app-logo-mark" alt="WA Analytics" />
          {!isLogin && <span>WA Tracker</span>}
        </Link>
        <div className="app-bar-fill" />
        {authed && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={triggerBackup}
              disabled={backupState === "loading"}
              title="Download backup ZIP"
            >
              {backupState === "loading" ? "Backing up…" : backupState === "error" ? "Failed" : "Backup"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setToken(null);
                navigate("/login");
              }}
            >
              Logout
            </button>
          </>
        )}
      </header>

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Accounts overview — centered container */}
        <Route
          path="/"
          element={
            <div className="container">
              <Accounts />
            </div>
          }
        />

        {/* Account area — sidebar layout */}
        <Route path="/accounts/:id" element={<AccountLayout />}>
          <Route
            index
            element={
              <div className="main-empty">
                <div className="main-empty-icon">👤</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  Select a contact
                </div>
                <div className="muted">
                  Choose a contact from the sidebar to view their details
                </div>
              </div>
            }
          />
          <Route path="contacts/:cid" element={<ContactDetail />} />
          <Route path="contacts/:cid/messages" element={<Messages />} />
        </Route>
      </Routes>
    </div>
  );
}
