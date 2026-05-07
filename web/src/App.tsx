import { useEffect } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "./lib/ws";
import Accounts from "./pages/Accounts";
import Dashboard from "./pages/Dashboard";
import ContactDetail from "./pages/ContactDetail";
import Messages from "./pages/Messages";

export default function App() {
  const qc = useQueryClient();

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
          // accountId not sent on these events (yet), invalidate all timelines for this contact
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

  return (
    <div className="container">
      <header className="header">
        <Link to="/" className="title" style={{ textDecoration: "none", color: "var(--fg)" }}>
          WhatsApp Tracker
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<Accounts />} />
        <Route path="/accounts/:id" element={<Dashboard />} />
        <Route path="/accounts/:id/contacts/:cid" element={<ContactDetail />} />
        <Route path="/accounts/:id/contacts/:cid/messages" element={<Messages />} />
      </Routes>
    </div>
  );
}
