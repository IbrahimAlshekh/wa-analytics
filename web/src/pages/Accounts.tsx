import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Account } from "../lib/types";
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
    <div className="col" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Linked accounts</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowPair((v) => !v)}
          >
            {showPair ? "Cancel" : "+ Add account"}
          </button>
        </div>

        {showPair && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div className="tabs">
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

        {list.length === 0 && !showPair && (
          <p className="muted">No accounts linked yet. Click "Add account" to get started.</p>
        )}

        {list.length > 0 && (
          <table className="contact-table" style={{ marginTop: showPair ? 16 : 0 }}>
            <thead>
              <tr>
                <th></th>
                <th>Number / Label</th>
                <th>Tracking</th>
                <th></th>
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
        )}
      </div>
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

  const saveLabel = useMutation({
    mutationFn: () => api.updateAccount(account.id, { label }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return (
    <tr>
      <td>
        <span
          className="dot"
          style={{
            background: account.connected
              ? "var(--accent)"
              : "var(--offline)",
          }}
          title={account.connected ? "Connected" : "Disconnected"}
        />
      </td>
      <td>
        <div>
          <Link to={`/accounts/${account.id}`} style={{ fontWeight: 500 }}>
            {account.label || account.jid}
          </Link>
        </div>
        {editing ? (
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <input
              className="input"
              style={{ width: 160 }}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <button
              className="btn btn-primary"
              style={{ padding: "4px 10px" }}
              onClick={() => saveLabel.mutate()}
            >
              Save
            </button>
            <button
              className="btn"
              style={{ padding: "4px 10px" }}
              onClick={() => {
                setLabel(account.label);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 11 }}>
            {account.jid}
            <button
              className="btn"
              style={{ fontSize: 11, padding: "1px 6px", marginLeft: 6 }}
              onClick={() => setEditing(true)}
            >
              rename
            </button>
          </div>
        )}
      </td>
      <td>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={account.trackingActive}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="muted">{account.trackingActive ? "On" : "Off"}</span>
        </label>
      </td>
      <td>
        <button className="btn btn-danger" onClick={onDelete}>
          Remove
        </button>
      </td>
    </tr>
  );
}
