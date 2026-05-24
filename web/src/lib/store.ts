import { create } from "zustand";
import type { Account } from "@/types/account";
import type { Contact } from "@/types/contact";
import type { TimelineEntry } from "@/types/timeline";

export function wsKey(accountId: number, contactId: number): string {
  return `${accountId}:${contactId}`;
}

function entryKey(e: TimelineEntry): string {
  return `${e.kind}:${e.at}:${e.state ?? ""}`;
}

interface AppStore {
  // Auth
  token: string | null;
  setToken: (t: string | null) => void;

  // Entities
  accounts: Account[];
  setAccounts: (list: Account[]) => void;
  upsertAccount: (a: Account) => void;
  removeAccount: (id: number) => void;

  contacts: Record<number, Contact>;
  upsertContacts: (list: Contact[]) => void;
  upsertContact: (c: Contact) => void;
  removeContact: (id: number) => void;

  // Live WS timeline entries per account+contact
  wsEntries: Record<string, TimelineEntry[]>;
  addWsEntry: (
    accountId: number,
    contactId: number,
    entry: TimelineEntry,
  ) => void;
  pruneWsEntries: (
    accountId: number,
    contactId: number,
    serverKeys: Set<string>,
  ) => void;

  // Last-known presence per contact — never pruned, only updated
  lastPresence: Record<
    string,
    { state: "available" | "unavailable"; at: number; lastSeen?: number }
  >;
  setLastPresence: (
    accountId: number,
    contactId: number,
    state: "available" | "unavailable",
    at: number,
    lastSeen?: number,
  ) => void;

  // App-level UI state
  backupState: "idle" | "loading" | "error";
  setBackupState: (s: "idle" | "loading" | "error") => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useStore = create<AppStore>((set) => ({
  // Auth
  token: localStorage.getItem("wt_bearer"),
  setToken: (t) => {
    if (t) localStorage.setItem("wt_bearer", t);
    else localStorage.removeItem("wt_bearer");
    set({ token: t });
  },

  // Accounts
  accounts: [],
  setAccounts: (list) => set({ accounts: list }),
  upsertAccount: (a) =>
    set((s) => ({
      accounts: s.accounts.some((x) => x.id === a.id)
        ? s.accounts.map((x) => (x.id === a.id ? a : x))
        : [...s.accounts, a],
    })),
  removeAccount: (id) =>
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) })),

  // Contacts
  contacts: {},
  upsertContacts: (list) =>
    set((s) => {
      const next = { ...s.contacts };
      for (const c of list) next[c.id] = c;
      return { contacts: next };
    }),
  upsertContact: (c) =>
    set((s) => ({ contacts: { ...s.contacts, [c.id]: c } })),
  removeContact: (id) =>
    set((s) => {
      const next = { ...s.contacts };
      delete next[id];
      return { contacts: next };
    }),

  // WS entries
  wsEntries: {},
  addWsEntry: (accountId, contactId, entry) => {
    const key = wsKey(accountId, contactId);
    const ek = entryKey(entry);
    set((s) => {
      const existing = s.wsEntries[key] ?? [];
      if (existing.some((e) => entryKey(e) === ek)) return s;
      return { wsEntries: { ...s.wsEntries, [key]: [...existing, entry] } };
    });
  },
  pruneWsEntries: (accountId, contactId, serverKeys) => {
    const key = wsKey(accountId, contactId);
    set((s) => ({
      wsEntries: {
        ...s.wsEntries,
        [key]: (s.wsEntries[key] ?? []).filter(
          (e) => !serverKeys.has(entryKey(e)),
        ),
      },
    }));
  },

  // Last-known presence
  lastPresence: {},
  setLastPresence: (accountId, contactId, state, at, lastSeen) => {
    const key = wsKey(accountId, contactId);
    set((s) => {
      const existing = s.lastPresence[key];
      if (existing && existing.at >= at) return s;
      return {
        lastPresence: { ...s.lastPresence, [key]: { state, at, lastSeen } },
      };
    });
  },

  // App UI
  backupState: "idle",
  setBackupState: (s) => set({ backupState: s }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
