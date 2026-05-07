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
    status: () => request("GET", "/auth/status"),
    startQR: () => request("POST", "/auth/qr"),
    pairPhone: (phone) => request("POST", "/auth/phone", { phone }),
    logout: () => request("POST", "/auth/logout"),
    listContacts: () => request("GET", "/contacts"),
    createContact: (phone, displayName) => request("POST", "/contacts", { phone, displayName }),
    updateContact: (id, body) => request("PATCH", `/contacts/${id}`, body),
    deleteContact: (id) => request("DELETE", `/contacts/${id}`),
    timeline: (id, since = 0) => request("GET", `/contacts/${id}/timeline?since=${since}`),
    stats: (id, range) => request("GET", `/contacts/${id}/stats?range=${range}`),
};
