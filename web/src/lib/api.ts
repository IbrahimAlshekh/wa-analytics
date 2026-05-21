import type {
  Account,
  AccountSchedule,
  AnalyticsRange,
  AnalyticsReport,
  Contact,
  ContactsPage,
  MessagesPage,
  ScheduleSlot,
  StatsSummary,
  TimelineResponse,
} from "./types";

const BASE = "/api";

function token(): string | null {
  return localStorage.getItem("wt_bearer");
}

/** Parse the expiry (exp) claim from a JWT without verifying the signature. */
function tokenExpiry(t: string): number | null {
  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Silently refresh the token if it expires within the next 30 minutes. */
async function maybeRefresh(): Promise<void> {
  const t = token();
  if (!t) return;
  const exp = tokenExpiry(t);
  if (!exp) return;
  const secsLeft = exp - Date.now() / 1000;
  if (secsLeft > 30 * 60) return; // plenty of time left

  try {
    const res = await fetch(`${BASE}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { token: string };
      localStorage.setItem("wt_bearer", data.token);
    }
  } catch {
    // Refresh failed silently — the next API call will handle the 401.
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  await maybeRefresh();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  if (res.status === 401) {
    localStorage.removeItem("wt_bearer");
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(data?.error ?? res.statusText);
  }
  return data as T;
}

export const api = {
  // Setup
  setupStatus: () => request<{ hasUsers: boolean }>("GET", "/setup/status"),
  setupRegister: (username: string, password: string) =>
    request<{ token: string }>("POST", "/setup/register", { username, password }),

  // Auth
  login: (username: string, password: string) =>
    request<{ token: string }>("POST", "/login", { username, password }),

  // Accounts
  listAccounts: () => request<Account[]>("GET", "/accounts"),
  startQR: () => request<{ started: boolean }>("POST", "/accounts/pair/qr"),
  pairPhone: (phone: string) =>
    request<{ code: string }>("POST", "/accounts/pair/phone", { phone }),
  updateAccount: (id: number, body: { label?: string; trackingActive?: boolean }) =>
    request<Account>("PATCH", `/accounts/${id}`, body),
  deleteAccount: (id: number) => request<void>("DELETE", `/accounts/${id}`),

  // Contacts (per-account)
  listContacts: (accountId: number, page = 1, limit = 20, search = "") => {
    const q = search ? `&q=${encodeURIComponent(search)}` : "";
    return request<ContactsPage>("GET", `/accounts/${accountId}/contacts?page=${page}&limit=${limit}${q}`);
  },
  syncContacts: (accountId: number) =>
    request<{ synced: number }>("POST", `/accounts/${accountId}/contacts/sync`),
  createContact: (accountId: number, phone: string, displayName: string) =>
    request<Contact>("POST", `/accounts/${accountId}/contacts`, { phone, displayName }),
  updateContact: (
    accountId: number,
    id: number,
    body: { displayName?: string; trackingEnabled?: boolean },
  ) => request<Contact>("PATCH", `/accounts/${accountId}/contacts/${id}`, body),
  deleteContact: (accountId: number, id: number) =>
    request<void>("DELETE", `/accounts/${accountId}/contacts/${id}`),

  // Timeline / Stats / Messages (per-contact)
  timeline: (accountId: number, contactId: number, since = 0) =>
    request<TimelineResponse>(
      "GET",
      `/accounts/${accountId}/contacts/${contactId}/timeline?since=${since}`,
    ),
  stats: (accountId: number, contactId: number, range: "today" | "week" | "month") =>
    request<StatsSummary>(
      "GET",
      `/accounts/${accountId}/contacts/${contactId}/stats?range=${range}`,
    ),
  messages: (accountId: number, contactId: number, before = 0, limit = 50) => {
    const q = before ? `before=${before}&limit=${limit}` : `limit=${limit}`;
    return request<MessagesPage>(
      "GET",
      `/accounts/${accountId}/contacts/${contactId}/messages?${q}`,
    );
  },
  analytics: (accountId: number, contactId: number, range: AnalyticsRange) =>
    request<AnalyticsReport>(
      "GET",
      `/accounts/${accountId}/contacts/${contactId}/analytics?range=${range}`,
    ),

  // Schedule (per-account)
  getSchedule: (accountId: number) =>
    request<AccountSchedule>("GET", `/accounts/${accountId}/schedule`),
  putSchedule: (accountId: number, forceOffline: boolean, slots: ScheduleSlot[]) =>
    request<AccountSchedule>("PUT", `/accounts/${accountId}/schedule`, { forceOffline, slots }),

  fetchMessageHistory: (accountId: number, contactId: number) =>
    request<{ started: boolean }>("POST", `/accounts/${accountId}/contacts/${contactId}/messages/fetch-history`),

  sendMessage: (accountId: number, contactId: number, text: string, file?: File) => {
    if (!file) {
      return request<{ id: string; timestamp: number }>(
        "POST",
        `/accounts/${accountId}/contacts/${contactId}/messages`,
        { text },
      );
    }
    const fd = new FormData();
    fd.append("text", text);
    fd.append("file", file);
    return requestRaw<{ id: string; timestamp: number }>(
      "POST",
      `/accounts/${accountId}/contacts/${contactId}/messages`,
      fd,
    );
  },
};

async function requestRaw<T>(method: string, path: string, body: FormData): Promise<T> {
  await maybeRefresh();
  const headers: Record<string, string> = {};
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body,
  });
  if (res.status === 401) {
    localStorage.removeItem("wt_bearer");
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(data?.error ?? res.statusText);
  }
  return data as T;
}
