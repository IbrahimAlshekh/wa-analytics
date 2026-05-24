import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "./api";
import { getMessages } from "./mockData";

const DEMO_TOKEN = "demo-token";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("api.login", () => {
  it("accepts any credentials and returns the demo token", async () => {
    const result = await api.login("anyone", "anything");
    expect(result.token).toBe(DEMO_TOKEN);
  });

  it("stores the token in localStorage", async () => {
    await api.login("u", "p");
    expect(localStorage.getItem("wt_bearer")).toBe(DEMO_TOKEN);
  });
});

describe("api.listAccounts", () => {
  it("returns a non-empty array of accounts", async () => {
    const accounts = await api.listAccounts();
    expect(accounts.length).toBeGreaterThan(0);
  });

  it("each account has the required fields", async () => {
    const accounts = await api.listAccounts();
    for (const acc of accounts) {
      expect(typeof acc.id).toBe("number");
      expect(typeof acc.label).toBe("string");
      expect(typeof acc.connected).toBe("boolean");
    }
  });
});

describe("api.sendMessage", () => {
  it("returns the sent message id and timestamp", async () => {
    const result = await api.sendMessage(1, 1, "hello test");
    expect(typeof result.id).toBe("string");
    expect(typeof result.timestamp).toBe("number");
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("mutates the in-memory message store (message becomes retrievable)", async () => {
    const text = `test-${Date.now()}`;
    await api.sendMessage(1, 1, text);

    const msgs = getMessages(1, 1);
    const found = msgs.find((m) => m.text === text);
    expect(found).toBeDefined();
    expect(found?.isFromMe).toBe(true);
  });
});

describe("api.listContacts", () => {
  it("returns paginated contacts for an account", async () => {
    const page = await api.listContacts(1, 1, 20, "");
    expect(page.contacts.length).toBeGreaterThan(0);
    expect(typeof page.total).toBe("number");
    expect(page.page).toBe(1);
  });

  it("filters contacts by search term", async () => {
    const all = await api.listContacts(1, 1, 50, "");
    const first = all.contacts[0];
    const filtered = await api.listContacts(1, 1, 50, first.displayName.slice(0, 4));
    expect(filtered.contacts.some((c) => c.id === first.id)).toBe(true);
  });
});

describe("api.setupStatus", () => {
  it("reports hasUsers true (demo always has seeded users)", async () => {
    const status = await api.setupStatus();
    expect(status.hasUsers).toBe(true);
  });
});
