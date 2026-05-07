const BASE = "/api";
function token() {
    return localStorage.getItem("wt_bearer");
}
async function request(method, path, body) {
    const headers = {};
    if (body !== undefined)
        headers["Content-Type"] = "application/json";
    const t = token();
    if (t)
        headers["Authorization"] = `Bearer ${t}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204)
        return undefined;
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
        throw new Error(data?.error ?? res.statusText);
    }
    return data;
}
export const api = {
    // Accounts
    listAccounts: () => request("GET", "/accounts"),
    startQR: () => request("POST", "/accounts/pair/qr"),
    pairPhone: (phone) => request("POST", "/accounts/pair/phone", { phone }),
    updateAccount: (id, body) => request("PATCH", `/accounts/${id}`, body),
    deleteAccount: (id) => request("DELETE", `/accounts/${id}`),
    // Contacts (per-account)
    listContacts: (accountId) => request("GET", `/accounts/${accountId}/contacts`),
    createContact: (accountId, phone, displayName) => request("POST", `/accounts/${accountId}/contacts`, { phone, displayName }),
    updateContact: (accountId, id, body) => request("PATCH", `/accounts/${accountId}/contacts/${id}`, body),
    deleteContact: (accountId, id) => request("DELETE", `/accounts/${accountId}/contacts/${id}`),
    // Timeline / Stats / Messages (per-contact)
    timeline: (accountId, contactId, since = 0) => request("GET", `/accounts/${accountId}/contacts/${contactId}/timeline?since=${since}`),
    stats: (accountId, contactId, range) => request("GET", `/accounts/${accountId}/contacts/${contactId}/stats?range=${range}`),
    messages: (accountId, contactId, before = 0, limit = 50) => {
        const q = before ? `before=${before}&limit=${limit}` : `limit=${limit}`;
        return request("GET", `/accounts/${accountId}/contacts/${contactId}/messages?${q}`);
    },
};
