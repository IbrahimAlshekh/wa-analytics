import { useEffect } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ws } from "./lib/ws";
import { useStore } from "./lib/store";
import AppHeader from "./components/layout/AppHeader";
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
  const { t } = useTranslation();
  const { token, addWsEntry, setLastPresence } = useStore();

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
        case "message_event": {
          const { accountId, contactId } = msg;
          qc.invalidateQueries({ queryKey: ["messages", accountId, contactId] });
          break;
        }
        case "story": {
          const { accountId, contactId } = msg;
          qc.invalidateQueries({ queryKey: ["stories", accountId, contactId] });
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppHeader />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Accounts overview — centered container */}
        <Route
          path="/"
          element={
            <div className="max-w-3xl mx-auto px-4 py-8">
              <Accounts />
            </div>
          }
        />

        {/* Account area — sidebar layout */}
        <Route path="/accounts/:id" element={<AccountLayout />}>
          <Route
            index
            element={
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                <span className="text-4xl">👤</span>
                <div className="font-semibold text-sm">{t("app.selectContact")}</div>
                <div className="text-sm text-muted-foreground">{t("app.selectContactDesc")}</div>
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
