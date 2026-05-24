import { describe, expect, it } from "vitest";
import {
  ACCOUNTS,
  CONTACTS,
  getAllContacts,
  getContactsByAccount,
  getMessages,
  getTimelineEntries,
  nextContactId,
} from "./mockData";

describe("ACCOUNTS / CONTACTS fixtures", () => {
  it("ACCOUNTS contains at least two entries", () => {
    expect(ACCOUNTS.length).toBeGreaterThanOrEqual(2);
  });

  it("CONTACTS has entries for each account", () => {
    for (const acc of ACCOUNTS) {
      expect(CONTACTS[acc.id].length).toBeGreaterThan(0);
    }
  });

  it("getAllContacts returns contacts from all accounts", () => {
    const all = getAllContacts();
    const total = Object.values(CONTACTS).reduce((s, c) => s + c.length, 0);
    expect(all).toHaveLength(total);
  });

  it("getContactsByAccount returns only that account's contacts", () => {
    const acc1 = getContactsByAccount(1);
    const acc2 = getContactsByAccount(2);
    const acc1Ids = new Set(acc1.map((c) => c.id));
    const acc2Ids = new Set(acc2.map((c) => c.id));
    // No overlap
    for (const id of acc2Ids) {
      expect(acc1Ids.has(id)).toBe(false);
    }
  });

  it("nextContactId returns a value greater than all existing ids", () => {
    const maxId = Math.max(...getAllContacts().map((c) => c.id));
    expect(nextContactId()).toBeGreaterThan(maxId);
  });
});

describe("getMessages — seedRng determinism", () => {
  it("returns a non-empty array", () => {
    const msgs = getMessages(1, 1);
    expect(msgs.length).toBeGreaterThan(0);
  });

  it("returns the same reference on repeated calls (cache is stable)", () => {
    const a = getMessages(1, 1);
    const b = getMessages(1, 1);
    expect(a).toBe(b);
  });

  it("different contacts produce different messages", () => {
    const m1 = getMessages(1, 1);
    const m2 = getMessages(1, 2);
    // At least the first message text should differ (different PRNG seed)
    expect(m1[0]?.text).not.toBe(m2[0]?.text);
  });

  it("all messages belong to the requested account and contact", () => {
    const msgs = getMessages(1, 1);
    for (const m of msgs) {
      expect(m.accountId).toBe(1);
      expect(m.contactId).toBe(1);
    }
  });
});

describe("getTimelineEntries — seedRng determinism", () => {
  it("returns a non-empty array with presence entries", () => {
    const entries = getTimelineEntries(1, 1);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.kind === "presence")).toBe(true);
  });

  it("returns the same reference on repeated calls", () => {
    const a = getTimelineEntries(1, 1);
    const b = getTimelineEntries(1, 1);
    expect(a).toBe(b);
  });

  it("entries are sorted by timestamp ascending", () => {
    const entries = getTimelineEntries(1, 1);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].at).toBeGreaterThanOrEqual(entries[i - 1].at);
    }
  });

  it("different contacts produce different timeline sequences", () => {
    const e1 = getTimelineEntries(1, 1);
    const e2 = getTimelineEntries(1, 2);
    // Different seeds → different first-entry timestamps
    expect(e1[0]?.at).not.toBe(e2[0]?.at);
  });
});
