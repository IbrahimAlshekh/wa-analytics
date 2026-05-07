import type {
  AuthStatus,
  Contact,
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
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(data?.error ?? res.statusText);
  }
  return data as T;
}

export const api = {
  status: () => request<AuthStatus>("GET", "/auth/status"),
  startQR: () => request<{ started: boolean }>("POST", "/auth/qr"),
  pairPhone: (phone: string) =>
    request<{ code: string }>("POST", "/auth/phone", { phone }),
  logout: () => request<{ ok: boolean }>("POST", "/auth/logout"),

  listContacts: () => request<Contact[]>("GET", "/contacts"),
  createContact: (phone: string, displayName: string) =>
    request<Contact>("POST", "/contacts", { phone, displayName }),
  updateContact: (
    id: number,
    body: { displayName?: string; trackingEnabled?: boolean },
  ) => request<Contact>("PATCH", `/contacts/${id}`, body),
  deleteContact: (id: number) => request<void>("DELETE", `/contacts/${id}`),

  timeline: (id: number, since = 0) =>
    request<TimelineResponse>("GET", `/contacts/${id}/timeline?since=${since}`),
  stats: (id: number, range: "today" | "week" | "month") =>
    request<StatsSummary>("GET", `/contacts/${id}/stats?range=${range}`),
};
