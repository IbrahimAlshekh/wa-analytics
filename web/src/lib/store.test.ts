import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { useStore as _UseStore, wsKey as _wsKey } from "./store";
import { makeAccount, makeContact, makeTimelineEntry } from "../test/fixtures";

// Import store lazily so each test file gets a clean module instance.
// Note: Zustand store is a singleton — we reset it between tests instead.
let useStore: typeof _UseStore;
let wsKey: typeof _wsKey;

beforeEach(async () => {
  localStorage.clear();
  const mod = await import("./store");
  useStore = mod.useStore;
  wsKey = mod.wsKey;
  // Reset store to initial state
  useStore.setState({
    token: null,
    accounts: [],
    contacts: {},
    wsEntries: {},
    lastPresence: {},
    backupState: "idle",
    sidebarOpen: false,
  });
});
afterEach(() => localStorage.clear());

describe("setToken", () => {
  it("stores token in localStorage and Zustand", () => {
    useStore.getState().setToken("my-jwt");
    expect(localStorage.getItem("wt_bearer")).toBe("my-jwt");
    expect(useStore.getState().token).toBe("my-jwt");
  });

  it("removes token from localStorage when set to null", () => {
    localStorage.setItem("wt_bearer", "old");
    useStore.getState().setToken(null);
    expect(localStorage.getItem("wt_bearer")).toBeNull();
    expect(useStore.getState().token).toBeNull();
  });
});

describe("upsertAccount / removeAccount", () => {
  it("inserts a new account", () => {
    const acc = makeAccount({ id: 1 });
    useStore.getState().upsertAccount(acc);
    expect(useStore.getState().accounts).toHaveLength(1);
  });

  it("replaces existing account by id", () => {
    const acc = makeAccount({ id: 1, label: "Old" });
    useStore.getState().upsertAccount(acc);
    useStore.getState().upsertAccount({ ...acc, label: "New" });
    expect(useStore.getState().accounts).toHaveLength(1);
    expect(useStore.getState().accounts[0].label).toBe("New");
  });

  it("removeAccount removes by id", () => {
    useStore.getState().upsertAccount(makeAccount({ id: 1 }));
    useStore.getState().upsertAccount(makeAccount({ id: 2 }));
    useStore.getState().removeAccount(1);
    expect(useStore.getState().accounts.map((a) => a.id)).toEqual([2]);
  });
});

describe("addWsEntry / pruneWsEntries", () => {
  it("addWsEntry appends new entries", () => {
    const entry = makeTimelineEntry({ at: 1000 });
    useStore.getState().addWsEntry(1, 1, entry);
    expect(useStore.getState().wsEntries[wsKey(1, 1)]).toHaveLength(1);
  });

  it("addWsEntry deduplicates by entryKey", () => {
    const entry = makeTimelineEntry({
      kind: "presence",
      at: 1000,
      state: "available",
    });
    useStore.getState().addWsEntry(1, 1, entry);
    useStore.getState().addWsEntry(1, 1, entry); // same entry
    expect(useStore.getState().wsEntries[wsKey(1, 1)]).toHaveLength(1);
  });

  it("pruneWsEntries filters entries matching serverKeys", () => {
    const e1 = makeTimelineEntry({
      kind: "presence",
      at: 1000,
      state: "available",
    });
    const e2 = makeTimelineEntry({
      kind: "presence",
      at: 2000,
      state: "unavailable",
    });
    useStore.getState().addWsEntry(1, 1, e1);
    useStore.getState().addWsEntry(1, 1, e2);

    // prune e1 (its key is in serverKeys)
    const serverKeys = new Set(["presence:1000:available"]);
    useStore.getState().pruneWsEntries(1, 1, serverKeys);

    const remaining = useStore.getState().wsEntries[wsKey(1, 1)];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].at).toBe(2000);
  });
});

describe("setLastPresence", () => {
  it("sets presence for a contact", () => {
    useStore.getState().setLastPresence(1, 1, "available", 1000);
    const p = useStore.getState().lastPresence[wsKey(1, 1)];
    expect(p.state).toBe("available");
    expect(p.at).toBe(1000);
  });

  it("ignores out-of-order events (older at)", () => {
    useStore.getState().setLastPresence(1, 1, "available", 2000);
    useStore.getState().setLastPresence(1, 1, "unavailable", 1000); // older
    const p = useStore.getState().lastPresence[wsKey(1, 1)];
    expect(p.state).toBe("available"); // not overwritten
    expect(p.at).toBe(2000);
  });

  it("updates with newer event", () => {
    useStore.getState().setLastPresence(1, 1, "available", 1000);
    useStore.getState().setLastPresence(1, 1, "unavailable", 3000);
    const p = useStore.getState().lastPresence[wsKey(1, 1)];
    expect(p.state).toBe("unavailable");
    expect(p.at).toBe(3000);
  });
});

describe("upsertContacts / upsertContact / removeContact", () => {
  it("upsertContacts bulk-inserts contacts", () => {
    const contacts = [makeContact({ id: 1 }), makeContact({ id: 2 })];
    useStore.getState().upsertContacts(contacts);
    expect(Object.keys(useStore.getState().contacts)).toHaveLength(2);
  });

  it("upsertContact replaces by id", () => {
    useStore
      .getState()
      .upsertContact(makeContact({ id: 1, displayName: "Old" }));
    useStore
      .getState()
      .upsertContact(makeContact({ id: 1, displayName: "New" }));
    expect(useStore.getState().contacts[1].displayName).toBe("New");
  });

  it("removeContact deletes by id", () => {
    useStore.getState().upsertContact(makeContact({ id: 1 }));
    useStore.getState().removeContact(1);
    expect(useStore.getState().contacts[1]).toBeUndefined();
  });
});
