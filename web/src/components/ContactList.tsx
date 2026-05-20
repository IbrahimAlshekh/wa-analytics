import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Contact } from "../lib/types";

interface Props {
  accountId: number;
}

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ContactList({ accountId }: Props) {
  const qc = useQueryClient();
  const contacts = useQuery({
    queryKey: ["contacts", accountId],
    queryFn: () => api.listContacts(accountId),
  });
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => api.syncContacts(accountId),
    onSuccess: (data) => {
      setSyncMsg(`Synced ${data.synced} contacts from WhatsApp`);
      setTimeout(() => setSyncMsg(null), 4000);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  const addMutation = useMutation({
    mutationFn: () => api.createContact(accountId, phone, name),
    onSuccess: () => {
      setPhone("");
      setName("");
      setError(null);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateContact(accountId, id, { trackingEnabled: enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", accountId] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteContact(accountId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts", accountId] }),
  });

  return (
    <div className="col" style={{ gap: 20 }}>

      {/* Page header */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Contacts
        </h2>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Import all contacts from WhatsApp (untracked)"
          >
            {syncMutation.isPending ? "Syncing…" : "Sync contacts"}
          </button>
          <button
            className={showForm ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
            onClick={() => { setShowForm((v) => !v); setError(null); }}
          >
            {showForm ? "Cancel" : "+ Add contact"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ fontSize: 13, color: "var(--fg-muted)", padding: "6px 0" }}>{syncMsg}</div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card">
          <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 600 }}>Add a contact to track</div>
          <form
            onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            <input
              className="input"
              placeholder="+14155551234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: "1 1 160px" }}
            />
            <input
              className="input"
              placeholder="Display name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: "2 1 200px" }}
            />
            <button className="btn btn-primary" type="submit" disabled={!phone || addMutation.isPending}>
              {addMutation.isPending ? "Adding…" : "Add"}
            </button>
          </form>
          {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {/* Contact table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="contact-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Contact</th>
              <th>About</th>
              <th style={{ width: 80 }}>Tracking</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {(contacts.data ?? []).map((c: Contact) => (
              <ContactRow
                key={c.id}
                accountId={accountId}
                contact={c}
                onToggle={(enabled) => toggle.mutate({ id: c.id, enabled })}
                onDelete={() => {
                  if (confirm(`Stop tracking ${c.displayName || c.phone}?`)) {
                    remove.mutate(c.id);
                  }
                }}
              />
            ))}
            {contacts.data && contacts.data.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <div style={{ fontWeight: 500 }}>No contacts yet</div>
                    <div className="muted">Add a contact above to start tracking</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactRow({
  accountId,
  contact,
  onToggle,
  onDelete,
}: {
  accountId: number;
  contact: Contact;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const timeline = useQuery({
    queryKey: ["timeline", accountId, contact.id],
    queryFn: () => api.timeline(accountId, contact.id, 0),
    refetchInterval: 60_000,
  });
  const entries = timeline.data?.entries ?? [];
  const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
  const lastAbout = [...entries].reverse().find((e) => e.kind === "about");

  const online = lastPresence?.state === "available";
  const displayName = contact.displayName || contact.phone;

  return (
    <tr>
      <td style={{ paddingLeft: 16 }}>
        <div className="avatar avatar-sm" style={{ position: "relative" }}>
          {getInitials(displayName)}
          <span
            className={`dot ${online ? "online" : ""}`}
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              border: "2px solid var(--card)",
            }}
          />
        </div>
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Link
            to={`/accounts/${accountId}/contacts/${contact.id}`}
            style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13 }}
          >
            {displayName}
          </Link>
          <span className="muted" style={{ fontSize: 11 }}>
            {contact.phone}
            {lastPresence && (
              <> · {online ? "Online now" : lastPresence.lastSeen
                ? `Last seen ${formatRelative(lastPresence.lastSeen)}`
                : `Offline ${formatRelative(lastPresence.at)}`}</>
            )}
          </span>
        </div>
      </td>
      <td>
        <div style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--fg-muted)" }}>
          {lastAbout?.text || <span className="muted">—</span>}
        </div>
      </td>
      <td>
        <label className="toggle" title={contact.trackingEnabled ? "Tracking on" : "Tracking off"}>
          <input
            type="checkbox"
            checked={contact.trackingEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="toggle-track" />
        </label>
      </td>
      <td style={{ paddingRight: 16 }}>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          Remove
        </button>
      </td>
    </tr>
  );
}

function formatRelative(unix: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - unix);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
