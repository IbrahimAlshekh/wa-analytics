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
          qc.setQueryData(["contacts"], (prev: unknown) => prev);
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

  return (
    <div className="container">
      <header className="header">
        <div className="title">WhatsApp Tracker</div>
        <div className="row">
          {status.data?.linked && (
            <span className="muted">{status.data.ownJID}</span>
          )}
          {status.data?.linked ? (
            <button
              className="btn btn-danger"
              onClick={async () => {
                await api.logout();
                qc.invalidateQueries({ queryKey: ["status"] });
                navigate("/login");
              }}
            >
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <Routes>
        <Route
          path="/"
          element={linked ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/login"
          element={linked ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/contacts/:id"
          element={
            linked ? <ContactDetail /> : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </div>
  );
}
