import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Contact } from "../lib/types";

export default function ContactList() {
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: ["contacts"], queryFn: api.listContacts });
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () => api.createContact(phone, name),
    onSuccess: () => {
      setPhone("");
      setName("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateContact(id, { trackingEnabled: enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteContact(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add contact</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
          className="row"
          style={{ gap: 8 }}
        >
          <input
            className="input"
            placeholder="+14155551234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="input"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!phone}>
            Add
          </button>
        </form>
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="contact-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Phone</th>
              <th>About</th>
              <th>Tracking</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(contacts.data ?? []).map((c: Contact) => (
              <ContactRow
                key={c.id}
                contact={c}
                onToggle={(enabled) =>
                  toggle.mutate({ id: c.id, enabled })
                }
                onDelete={() => {
                  if (confirm(`Stop tracking ${c.displayName || c.phone}?`)) {
                    remove.mutate(c.id);
                  }
                }}
              />
            ))}
            {contacts.data && contacts.data.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 24 }}>
                  No contacts yet — add one above.
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
  contact,
  onToggle,
  onDelete,
}: {
  contact: Contact;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const timeline = useQuery({
    queryKey: ["timeline", contact.id],
    queryFn: () => api.timeline(contact.id, 0),
    refetchInterval: 60_000,
  });
  const entries = timeline.data?.entries ?? [];
  const lastPresence = [...entries].reverse().find((e) => e.kind === "presence");
  const lastAbout = [...entries].reverse().find((e) => e.kind === "about");
  const lastPic = [...entries].reverse().find((e) => e.kind === "picture");

  const online = lastPresence?.state === "available";

  return (
    <tr>
      <td>
        <span className={`dot ${online ? "online" : ""}`} />
      </td>
      <td>
        <Link to={`/contacts/${contact.id}`}>
          {contact.displayName || contact.phone}
        </Link>
        {lastPresence && (
          <div className="muted" style={{ fontSize: 11 }}>
            {online
              ? "Online now"
              : lastPresence.lastSeen
                ? `Last seen ${formatRelative(lastPresence.lastSeen)}`
                : `Offline since ${formatRelative(lastPresence.at)}`}
          </div>
        )}
      </td>
      <td className="muted">{contact.phone}</td>
      <td>
        <div style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lastAbout?.text || <span className="muted">—</span>}
        </div>
        {lastPic?.url && (
          <span className="muted" style={{ fontSize: 11 }}>
            pic updated {formatRelative(lastPic.at)}
          </span>
        )}
      </td>
      <td>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={contact.trackingEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="muted">{contact.trackingEnabled ? "On" : "Off"}</span>
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

function formatRelative(unix: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - unix);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
