import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Contact } from "../lib/types";
import { useStore } from "../lib/store";

interface Props {
  accountId: number;
}

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const PAGE_SIZE = 20;

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ContactList({ accountId }: Props) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);

  useEffect(() => { setPage(1); }, [search]);

  const upsertContacts = useStore((s) => s.upsertContacts);
  const upsertContact  = useStore((s) => s.upsertContact);
  const removeContact  = useStore((s) => s.removeContact);

  const contacts = useQuery({
    queryKey: ["contacts", accountId, page, search],
    queryFn: () => api.listContacts(accountId, page, PAGE_SIZE, search),
  });

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const list = contacts.data?.contacts ?? [];

  // Seed store whenever query returns fresh contact data
  useEffect(() => {
    if (list.length > 0) upsertContacts(list);
  }, [list, upsertContacts]);

  const syncMutation = useMutation({
    mutationFn: () => api.syncContacts(accountId),
    onSuccess: (data) => {
      setSyncMsg(`Synced ${data.synced} contacts from WhatsApp`);
      setTimeout(() => setSyncMsg(null), 4000);
      setPage(1);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  const addMutation = useMutation({
    mutationFn: () => api.createContact(accountId, phone, name),
    onSuccess: (created) => {
      upsertContact(created);
      setPhone("");
      setName("");
      setError(null);
      setShowForm(false);
      setPage(1);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateContact(accountId, id, { trackingEnabled: enabled }),
    onSuccess: (updated) => {
      upsertContact(updated);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteContact(accountId, id),
    onSuccess: (_, id) => {
      removeContact(id);
      const remaining = (contacts.data?.contacts.length ?? 1) - 1;
      if (remaining === 0 && page > 1) setPage((p) => p - 1);
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
    },
  });

  const total = contacts.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      {/* Search */}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--fg-muted)", pointerEvents: "none", fontSize: 14,
        }}>⌕</span>
        <input
          className="input"
          style={{ width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
          placeholder="Search by name or phone…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--fg-muted)", fontSize: 16, lineHeight: 1, padding: "0 2px",
            }}
            onClick={() => setSearchInput("")}
          >×</button>
        )}
      </div>

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
            {list.map((c: Contact) => (
              <ContactRow
                key={c.id}
                accountId={accountId}
                contactId={c.id}
                onToggle={(enabled) => toggle.mutate({ id: c.id, enabled })}
                onDelete={() => {
                  const contact = c;
                  if (confirm(`Stop tracking ${contact.displayName || contact.phone}?`)) {
                    remove.mutate(c.id);
                  }
                }}
              />
            ))}
            {contacts.data && list.length === 0 && (
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

        {/* Pagination */}
        {total > 0 && (
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            <span className="muted">
              {total === 0 ? "No contacts" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </span>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                ‹ Prev
              </button>
              {pageRange(page, totalPages).map((p, i) =>
                p === null ? (
                  <span key={`ellipsis-${i}`} className="muted" style={{ padding: "0 4px" }}>…</span>
                ) : (
                  <button
                    key={p}
                    className="btn btn-sm"
                    aria-current={p === page ? "page" : undefined}
                    onClick={() => setPage(p)}
                    style={p === page ? { fontWeight: 700 } : undefined}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  accountId,
  contactId,
  onToggle,
  onDelete,
}: {
  accountId: number;
  contactId: number;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  // Read entirely from store — updates from any component are reflected here
  const contact = useStore((s) => s.contacts[contactId]);
  const wsEntries = useStore((s) => s.wsEntries[`${accountId}:${contactId}`]) ?? [];

  if (!contact) return null;

  const entries = wsEntries;
  const lastPresence = [...entries]
    .filter((e) => e.kind === "presence")
    .sort((a, b) => b.at - a.at)[0];
  const lastAbout = [...entries]
    .filter((e) => e.kind === "about")
    .sort((a, b) => b.at - a.at)[0];

  const online = lastPresence?.state === "available";
  const displayName = contact.displayName || contact.phone;

  function formatRelative(unix: number): string {
    const now = Date.now() / 1000;
    const diff = Math.max(0, now - unix);
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

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

function pageRange(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push(null);
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}
