import type {
  Account,
  AccountSchedule,
  AnalyticsRange,
  Contact,
  ContactsPage,
  Message,
  MessagesPage,
  ScheduleSlot,
  StatsSummary,
  TimelineResponse,
} from "./types";
import {
  ACCOUNTS,
  CONTACTS,
  SCHEDULES,
  STORIES,
  NOW,
  getAnalytics,
  getContactsByAccount,
  getMessages,
  getTimelineEntries,
  addMessage,
  nextContactId,
} from "./mockData";
import { pushEvent } from "./mockEvents";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms = 150): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const DEMO_TOKEN = "demo-token";

// ─── Mutable session state ────────────────────────────────────────────────────

let accounts: Account[] = ACCOUNTS.map((a) => ({ ...a }));
const schedules: Record<number, AccountSchedule> = {
  1: { ...SCHEDULES[1], slots: SCHEDULES[1].slots.map((s) => ({ ...s })) },
  2: { ...SCHEDULES[2], slots: SCHEDULES[2].slots.map((s) => ({ ...s })) },
};

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // Setup
  setupStatus: async () => {
    await delay(80);
    return { hasUsers: true };
  },
  setupRegister: async (_u: string, _p: string) => {
    await delay(300);
    localStorage.setItem("wt_bearer", DEMO_TOKEN);
    return { token: DEMO_TOKEN };
  },

  // Auth — accepts any credentials
  login: async (_u: string, _p: string) => {
    await delay(350);
    localStorage.setItem("wt_bearer", DEMO_TOKEN);
    return { token: DEMO_TOKEN };
  },

  // Accounts
  listAccounts: async () => {
    await delay(120);
    return [...accounts];
  },
  startQR: async () => {
    await delay(200);
    const fakeQR =
      "2@demo-qr-code-for-whatsapp-tracker-demo,abc123XYZ,mockSecret,serverRandom1,clientRandom1";
    setTimeout(() => pushEvent({ type: "auth.qr", code: fakeQR }), 1500);
    let rotateCount = 0;
    const rotateId = setInterval(() => {
      rotateCount++;
      if (rotateCount > 5) {
        clearInterval(rotateId);
        return;
      }
      pushEvent({
        type: "auth.qr",
        code: `2@demo-qr-rotate-${rotateCount},abc123XYZ,mockSecret,server${rotateCount},client${rotateCount}`,
      });
    }, 20_000);
    void rotateId;
    return { started: true };
  },
  pairPhone: async (_phone: string) => {
    await delay(600);
    return { code: "123-456" };
  },
  updateAccount: async (id: number, body: { label?: string; trackingActive?: boolean }) => {
    await delay(150);
    const acc = accounts.find((a) => a.id === id);
    if (!acc) throw new Error("account not found");
    if (body.label !== undefined) acc.label = body.label;
    if (body.trackingActive !== undefined) acc.trackingActive = body.trackingActive;
    return { ...acc };
  },
  deleteAccount: async (id: number) => {
    await delay(150);
    accounts = accounts.filter((a) => a.id !== id);
  },

  // Contacts
  listContacts: async (accountId: number, page = 1, limit = 20, search = "") => {
    await delay(130);
    let list = [...(CONTACTS[accountId] ?? [])];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.displayName.toLowerCase().includes(q) || c.phone.includes(q),
      );
    }
    const total = list.length;
    const sliced = list.slice((page - 1) * limit, page * limit);
    return { contacts: sliced, total, page, limit } as ContactsPage;
  },
  syncContacts: async (_accountId: number) => {
    await delay(700);
    return { synced: 0 };
  },
  createContact: async (accountId: number, phone: string, displayName: string) => {
    await delay(200);
    const contact: Contact = {
      id: nextContactId(),
      jid: `${phone}@s.whatsapp.net`,
      phone,
      displayName,
      addedAt: NOW(),
      trackingEnabled: true,
    };
    if (!CONTACTS[accountId]) CONTACTS[accountId] = [];
    CONTACTS[accountId].push(contact);
    return contact;
  },
  updateContact: async (
    accountId: number,
    id: number,
    body: { displayName?: string; trackingEnabled?: boolean },
  ) => {
    await delay(150);
    const c = (CONTACTS[accountId] ?? []).find((x) => x.id === id);
    if (!c) throw new Error("contact not found");
    if (body.displayName !== undefined) c.displayName = body.displayName;
    if (body.trackingEnabled !== undefined) c.trackingEnabled = body.trackingEnabled;
    return { ...c };
  },
  deleteContact: async (accountId: number, id: number) => {
    await delay(150);
    if (CONTACTS[accountId]) {
      CONTACTS[accountId] = CONTACTS[accountId].filter((c) => c.id !== id);
    }
  },

  // Timeline / Stats
  timeline: async (accountId: number, contactId: number, since = 0) => {
    await delay(140);
    const contact = getContactsByAccount(accountId).find((c) => c.id === contactId);
    if (!contact) throw new Error("contact not found");
    const entries = getTimelineEntries(accountId, contactId).filter((e) => e.at > since);
    return { contact, entries } as TimelineResponse;
  },
  stats: async (accountId: number, contactId: number, range: "today" | "week" | "month") => {
    await delay(130);
    const n = NOW();
    const DAY = 86400;
    const numDays = range === "today" ? 1 : range === "week" ? 7 : 30;
    const entries = getTimelineEntries(accountId, contactId);
    const days: { date: string; onlineSeconds: number }[] = [];
    let totalOnline = 0;

    for (let i = numDays - 1; i >= 0; i--) {
      const dayStart = n - i * DAY;
      const dayEnd = dayStart + DAY;
      const date = new Date(dayStart * 1000).toISOString().slice(0, 10);
      let online = 0;
      let lastOn: number | null = null;
      for (const e of entries) {
        if (e.at < dayStart || e.at >= dayEnd || e.kind !== "presence") continue;
        if (e.state === "available") lastOn = e.at;
        else if (e.state === "unavailable" && lastOn !== null) {
          online += e.at - lastOn;
          lastOn = null;
        }
      }
      totalOnline += online;
      days.push({ date, onlineSeconds: online });
    }

    return {
      range,
      startUnix: n - numDays * DAY,
      endUnix: n,
      days,
      onlineSecondsAll: totalOnline,
      pictureChanges: 2,
      aboutChanges: 1,
    } as StatsSummary;
  },

  // Messages — returned newest-first so getNextPageParam in Messages.tsx paginates correctly
  messages: async (accountId: number, contactId: number, before = 0, limit = 50) => {
    await delay(140);
    let msgs = [...getMessages(accountId, contactId)];
    if (before) msgs = msgs.filter((m) => m.timestamp < before);
    msgs.sort((a, b) => b.timestamp - a.timestamp);
    return { messages: msgs.slice(0, limit), events: [] } as MessagesPage;
  },

  analytics: async (accountId: number, contactId: number, range: AnalyticsRange) => {
    await delay(180);
    return getAnalytics(accountId, contactId, range);
  },

  // Schedule
  getSchedule: async (accountId: number) => {
    await delay(120);
    return schedules[accountId] ?? { forceOffline: false, slots: [] };
  },
  putSchedule: async (accountId: number, forceOffline: boolean, slots: ScheduleSlot[]) => {
    await delay(150);
    schedules[accountId] = { forceOffline, slots };
    return schedules[accountId];
  },

  stories: async (accountId: number, contactId: number) => {
    await delay(130);
    return STORIES[`${accountId}:${contactId}`] ?? [];
  },

  refreshPicture: async (_accountId: number, _contactId: number) => {
    await delay(250);
    return { started: true };
  },

  fetchMessageHistory: async (accountId: number, _contactId: number) => {
    await delay(300);
    // Fire a history_sync WS event after 2 s — the Messages page listens for this
    // to trigger the exhaustion flow (allowExtraPageRef → fetchNextPage → 0 results)
    setTimeout(() => pushEvent({ type: "history_sync", accountId }), 2000);
    return { started: true };
  },

  sendMessage: async (accountId: number, contactId: number, text: string, _file?: File) => {
    await delay(200);
    const n = NOW();
    const contact = getContactsByAccount(accountId).find((c) => c.id === contactId);
    const acc = accounts.find((a) => a.id === accountId);
    const id = `msg_sent_${Date.now()}`;
    const msg: Message = {
      id: Date.now(),
      accountId,
      contactId,
      chatJid: contact?.jid ?? "",
      messageId: id,
      senderJid: acc?.jid ?? "",
      isFromMe: true,
      timestamp: n,
      text,
      receivedAt: n,
    };
    addMessage(accountId, contactId, msg);
    return { id, timestamp: n };
  },
};
