import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "./lib/ws";
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

  useEffect(() => {
    const token = localStorage.getItem("wt_bearer");
    if (!token && !publicPaths.includes(location.pathname)) {
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
      }
    });
    return off;
  }, [qc]);

  const [backupState, setBackupState] = useState<"idle" | "loading" | "error">("idle");

  async function triggerBackup() {
    if (backupState === "loading") return;
    setBackupState("loading");
    try {
      const token = localStorage.getItem("wt_bearer");
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
  const authed = Boolean(localStorage.getItem("wt_bearer"));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="app-bar">
        <Link to="/" className="app-logo">
          <div className="app-logo-mark">W</div>
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
                localStorage.removeItem("wt_bearer");
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
