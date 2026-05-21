import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useMatch, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Contact } from "../lib/types";
import { useStore } from "../lib/store";

function getInitials(name: string): string {
  if (name.startsWith("+")) return name.slice(1, 3);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function useDebounce(value: string, delay: number): string {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function formatRelative(unix: number): string {
  const diff = Math.max(0, Date.now() / 1000 - unix);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PAGE_SIZE = 50;

export default function AccountLayout() {
  const { id: accountIdStr } = useParams<{ id: string }>();
  const accountId = Number(accountIdStr);

  const contactMatch = useMatch("/accounts/:id/contacts/:cid");
  const messagesMatch = useMatch("/accounts/:id/contacts/:cid/messages");
  const activeCidStr = contactMatch?.params.cid ?? messagesMatch?.params.cid;
  const activeCid = activeCidStr ? Number(activeCidStr) : null;
  const isMessages = Boolean(messagesMatch);

  const sidebarOpen    = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const upsertContacts = useStore((s) => s.upsertContacts);
  const upsertContact  = useStore((s) => s.upsertContact);

  // Auto-close drawer when navigating to a contact
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeCid, setSidebarOpen]);

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const qc = useQueryClient();

  const contactsQ = useInfiniteQuery({
    queryKey: ["contacts-sidebar", accountId, search],
    queryFn: ({ pageParam }) =>
      api.listContacts(accountId, pageParam as number, PAGE_SIZE, search),
    initialPageParam: 1,
    getNextPageParam: (_lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + (p.contacts?.length ?? 0), 0);
      const total = allPages[0]?.total ?? 0;
      return loaded < total ? allPages.length + 1 : undefined;
    },
    refetchInterval: 30_000,
  });

  const allContacts = useMemo(
    () => contactsQ.data?.pages.flatMap((p) => p.contacts ?? []) ?? [],
    [contactsQ.data],
  );
  const total = contactsQ.data?.pages[0]?.total ?? 0;

  // Seed the store with fresh contact data from the sidebar query
  useEffect(() => {
    if (allContacts.length > 0) upsertContacts(allContacts);
  }, [allContacts, upsertContacts]);

  const syncMutation = useMutation({
    mutationFn: () => api.syncContacts(accountId),
    onSuccess: (data) => {
      setSyncMsg(`Synced ${data.synced}`);
      setTimeout(() => setSyncMsg(null), 3000);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) =>
      setSyncMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  const addMutation = useMutation({
    mutationFn: () => api.createContact(accountId, phone, addName),
    onSuccess: (created) => {
      upsertContact(created);
      setPhone("");
      setAddName("");
      setAddError(null);
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["contacts-sidebar", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
    onError: (e) => setAddError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="account-layout">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <span className="sidebar-title">Contacts</span>
          <div className="row" style={{ gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              title="Sync contacts from WhatsApp"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? "…" : "↻"}
            </button>
            <button
              className={`btn btn-sm ${showAdd ? "" : "btn-primary"}`}
              onClick={() => {
                setShowAdd((v) => !v);
                setAddError(null);
              }}
            >
              {showAdd ? "✕" : "+"}
            </button>
            <button
              className="sidebar-close-btn btn btn-ghost btn-sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close contacts"
            >
              ✕
            </button>
          </div>
        </div>

        {syncMsg && <div className="sidebar-sync-msg">{syncMsg}</div>}

        {/* Add contact form */}
        {showAdd && (
          <div className="sidebar-add-form">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate();
              }}
            >
              <input
                className="input"
                placeholder="+14155551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ marginBottom: 6, fontSize: 13 }}
              />
              <input
                className="input"
                placeholder="Name (optional)"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                style={{ marginBottom: 6, fontSize: 13 }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!phone || addMutation.isPending}
                style={{ width: "100%" }}
              >
                {addMutation.isPending ? "Adding…" : "Add contact"}
              </button>
              {addError && (
                <div className="error" style={{ marginTop: 6, fontSize: 12 }}>
                  {addError}
                </div>
              )}
            </form>
          </div>
        )}

        {/* Search */}
        <div className="sidebar-search">
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--fg-muted)",
                fontSize: 13,
                pointerEvents: "none",
              }}
            >
              ⌕
            </span>
            <input
              className="input"
              style={{ paddingLeft: 28, fontSize: 13 }}
              placeholder="Search…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-muted)",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                onClick={() => setSearchInput("")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Contact list */}
        <div className="sidebar-contacts">
          {contactsQ.isLoading && (
            <div className="sidebar-empty">Loading…</div>
          )}
          {!contactsQ.isLoading && allContacts.length === 0 && (
            <div className="sidebar-empty">
              {search ? "No results" : "No contacts yet"}
            </div>
          )}
          {allContacts.map((c) => (
            <SidebarContact
              key={c.id}
              accountId={accountId}
              contact={c}
              active={c.id === activeCid}
            />
          ))}
          {allContacts.length < total && (
            <button
              className="btn btn-ghost sidebar-load-more"
              onClick={() => contactsQ.fetchNextPage()}
              disabled={contactsQ.isFetchingNextPage}
            >
              {contactsQ.isFetchingNextPage
                ? "Loading…"
                : `${total - allContacts.length} more…`}
            </button>
          )}
        </div>
      </aside>

      <main className={`main-content${isMessages ? " main-content-messages" : ""}`}>
        <div className="mobile-nav-bar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open contacts"
            style={{ padding: "6px 8px" }}
          >
            ☰
          </button>
          <span>Contacts</span>
        </div>
        <div className={`page-content${isMessages ? " page-content-fill" : ""}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarContact({
  accountId,
  contact: contactProp,
  active,
}: {
  accountId: number;
  contact: Contact;
  active: boolean;
}) {
  // Read from store for live updates (falls back to prop while store seeds)
  const storeContact = useStore((s) => s.contacts[contactProp.id]);
  const contact = storeContact ?? contactProp;

  const presence = useStore((s) => s.lastPresence[`${accountId}:${contact.id}`]);

  const displayName = contact.displayName || contact.phone;

  const online = presence?.state === "available";

  const lastSeenText = online
    ? "Online now"
    : presence
    ? presence.lastSeen
      ? `Last seen ${formatRelative(presence.lastSeen)}`
      : `Offline ${formatRelative(presence.at)}`
    : contact.trackingEnabled
    ? "No activity yet"
    : null;

  return (
    <Link
      to={`/accounts/${accountId}/contacts/${contact.id}`}
      className={`sidebar-contact${active ? " sidebar-contact-active" : ""}`}
    >
      <div
        className="avatar avatar-sm"
        style={{ position: "relative", flexShrink: 0 }}
      >
        {getInitials(displayName)}
        <span
          className={`dot ${online ? "online" : ""}`}
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 8,
            height: 8,
            border: "2px solid var(--sidebar-bg)",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--fg)",
          }}
        >
          {displayName}
        </div>
        {lastSeenText && (
          <div
            style={{
              fontSize: 11,
              color: online ? "var(--accent)" : "var(--fg-muted)",
              marginTop: 1,
            }}
          >
            {lastSeenText}
          </div>
        )}
      </div>
      {!contact.trackingEnabled && (
        <span className="sidebar-paused-tag">paused</span>
      )}
    </Link>
  );
}
