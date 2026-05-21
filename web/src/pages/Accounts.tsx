import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Account, ScheduleSlot } from "../lib/types";
import QRView from "../components/QRView";
import PhoneCodeView from "../components/PhoneCodeView";

export default function Accounts() {
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
  const [showPair, setShowPair] = useState(false);
  const [pairTab, setPairTab] = useState<"qr" | "phone">("qr");

  const toggle = useMutation({
    mutationFn: ({ id, trackingActive }: { id: number; trackingActive: boolean }) =>
      api.updateAccount(id, { trackingActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const list: Account[] = accounts.data ?? [];

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* Page header */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Linked accounts
        </h2>
        <button
          className={showPair ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
          onClick={() => setShowPair((v) => !v)}
        >
          {showPair ? "Cancel" : "+ Add account"}
        </button>
      </div>

      {/* Pairing panel */}
      {showPair && (
        <div className="card">
          <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Link a WhatsApp account</div>
          <div className="tabs" style={{ marginBottom: 20, width: "fit-content" }}>
            <button
              className="btn"
              aria-current={pairTab === "qr"}
              onClick={() => setPairTab("qr")}
            >
              QR code
            </button>
            <button
              className="btn"
              aria-current={pairTab === "phone"}
              onClick={() => setPairTab("phone")}
            >
              Phone code
            </button>
          </div>
          {pairTab === "qr" ? <QRView /> : <PhoneCodeView />}
        </div>
      )}

      {/* Account list */}
      {list.length === 0 && !showPair && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📱</div>
            <div style={{ fontWeight: 500 }}>No accounts linked yet</div>
            <div className="muted">Click "+ Add account" to link your WhatsApp</div>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="contact-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Account</th>
                <th style={{ width: 100 }}>Tracking</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((acc) => (
                <AccountRow
                  key={acc.id}
                  account={acc}
                  onToggle={(v) => toggle.mutate({ id: acc.id, trackingActive: v })}
                  onDelete={() => {
                    if (confirm(`Remove account ${acc.label || acc.jid}?`))
                      remove.mutate(acc.id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccountRow({
  account,
  onToggle,
  onDelete,
}: {
  account: Account;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(account.label);
  const [showSchedule, setShowSchedule] = useState(false);

  const saveLabel = useMutation({
    mutationFn: () => api.updateAccount(account.id, { label }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const initials = (account.label || account.jid || "?").slice(0, 2).toUpperCase();

  return (
    <>
      <tr>
        <td style={{ paddingLeft: 16 }}>
          <div
            className="avatar avatar-sm"
            style={{
              background: account.connected ? "var(--accent-dim)" : "rgba(148,163,184,0.15)",
              color: account.connected ? "var(--accent)" : "var(--fg-muted)",
              position: "relative",
            }}
          >
            {initials}
            <span
              className={`dot ${account.connected ? "online" : ""}`}
              style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, border: "2px solid var(--card)" }}
            />
          </div>
        </td>
        <td>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Link to={`/accounts/${account.id}`} style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13 }}>
              {account.label || account.jid}
            </Link>
            {editing ? (
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                <input
                  className="input"
                  style={{ width: 160, padding: "4px 8px", fontSize: 12 }}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  autoFocus
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => saveLabel.mutate()}
                >
                  Save
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setLabel(account.label); setEditing(false); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span className="muted" style={{ fontSize: 11 }}>
                {account.jid}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "1px 6px", marginLeft: 4, height: "auto" }}
                  onClick={() => setEditing(true)}
                >
                  rename
                </button>
              </span>
            )}
          </div>
        </td>
        <td>
          <label className="toggle" title={account.trackingActive ? "Tracking on" : "Tracking off"}>
            <input
              type="checkbox"
              checked={account.trackingActive}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </td>
        <td style={{ paddingRight: 16 }}>
          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
            <button
              className={`btn btn-sm ${showSchedule ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setShowSchedule((v) => !v)}
              title="Connection schedule"
            >
              Schedule
            </button>
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              Remove
            </button>
          </div>
        </td>
      </tr>
      {showSchedule && (
        <tr>
          <td colSpan={4} style={{ padding: 0 }}>
            <SchedulePanel accountId={account.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function SchedulePanel({ accountId }: { accountId: number }) {
  const qc = useQueryClient();

  const schedule = useQuery({
    queryKey: ["schedule", accountId],
    queryFn: () => api.getSchedule(accountId),
  });

  const [forceOffline, setForceOffline] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (schedule.data) {
      setForceOffline(schedule.data.forceOffline);
      setSlots(schedule.data.slots);
      setDirty(false);
    }
  }, [schedule.data]);

  const save = useMutation({
    mutationFn: () => api.putSchedule(accountId, forceOffline, slots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule", accountId] });
      setDirty(false);
    },
  });

  function addSlot() {
    setSlots((prev) => [...prev, { id: 0, startMin: 9 * 60, endMin: 17 * 60 }]);
    setDirty(true);
  }

  function removeSlot(i: number) {
    setSlots((prev) => prev.filter((_, j) => j !== i));
    setDirty(true);
  }

  function updateSlot(i: number, field: "startMin" | "endMin", value: number) {
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
    setDirty(true);
  }

  if (schedule.isLoading) {
    return <div style={{ padding: "12px 16px" }} className="muted">Loading schedule…</div>;
  }

  return (
    <div className="schedule-panel">
      <div className="schedule-panel-title">Connection Schedule</div>

      <label className="schedule-toggle-row">
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>Force offline</div>
          <div className="muted" style={{ fontSize: 12 }}>Immediately disconnect and stay offline until toggled off</div>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={forceOffline}
            onChange={(e) => { setForceOffline(e.target.checked); setDirty(true); }}
          />
          <span className="toggle-track" />
        </label>
      </label>

      {!forceOffline && (
        <div className="schedule-slots">
          <div className="schedule-slots-label">
            Active time slots
            <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>(empty = always connected)</span>
          </div>
          {slots.map((s, i) => (
            <div key={i} className="schedule-slot-row">
              <input
                type="time"
                className="input"
                style={{ width: 110, padding: "4px 8px", fontSize: 13 }}
                value={minutesToTime(s.startMin)}
                onChange={(e) => updateSlot(i, "startMin", timeToMinutes(e.target.value))}
              />
              <span className="muted">–</span>
              <input
                type="time"
                className="input"
                style={{ width: 110, padding: "4px 8px", fontSize: 13 }}
                value={minutesToTime(s.endMin)}
                onChange={(e) => updateSlot(i, "endMin", timeToMinutes(e.target.value))}
              />
              {s.startMin >= s.endMin && (
                <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>overnight</span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => removeSlot(i)} style={{ marginLeft: "auto" }}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addSlot} style={{ alignSelf: "flex-start" }}>
            + Add slot
          </button>
        </div>
      )}

      <div className="schedule-panel-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {save.isError && (
          <span style={{ fontSize: 12, color: "var(--danger)" }}>Save failed</span>
        )}
        {save.isSuccess && !dirty && (
          <span className="muted" style={{ fontSize: 12 }}>Saved</span>
        )}
      </div>
    </div>
  );
}
