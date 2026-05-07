import type {
  Account,
  Contact,
  Message,
  StatsSummary,
  TimelineResponse,
} from "./types";

const BASE = "/api";

function token(): string | null {
  return localStorage.getItem("wt_bearer");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
  listContacts: (accountId: number) =>
    request<Contact[]>("GET", `/accounts/${accountId}/contacts`),
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
    return request<Message[]>(
      "GET",
      `/accounts/${accountId}/contacts/${contactId}/messages?${q}`,
    );
  },
};
