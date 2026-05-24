import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";

// We import the api object AFTER localStorage is set up so the module-level
// token() call sees the right value.
async function importApi() {
  vi.resetModules();
  const mod = await import("./api");
  return mod.api;
}

const BASE = "/api";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("Authorization header", () => {
  it("attaches Bearer token when token is set", async () => {
    localStorage.setItem("wt_bearer", "my-token");
    let capturedAuth: string | null = null;
    server.use(
      http.get(`${BASE}/accounts`, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );
    const api = await importApi();
    await api.listAccounts();
    expect(capturedAuth).toBe("Bearer my-token");
  });

  it("omits Authorization header when no token", async () => {
    let capturedAuth: string | null | undefined = undefined;
    server.use(
      http.get(`${BASE}/accounts`, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json([]);
      }),
    );
    const api = await importApi();
    await api.listAccounts();
    expect(capturedAuth).toBeNull();
  });
});

describe("204 response", () => {
  it("returns undefined for 204 No Content", async () => {
    server.use(
      http.delete(`${BASE}/accounts/1`, () => new HttpResponse(null, { status: 204 })),
    );
    const api = await importApi();
    const result = await api.deleteAccount(1);
    expect(result).toBeUndefined();
  });
});

describe("401 response", () => {
  it("clears token and throws 'unauthorized' on 401", async () => {
    localStorage.setItem("wt_bearer", "bad-token");
    server.use(
      http.get(`${BASE}/accounts`, () => new HttpResponse(null, { status: 401 })),
    );
    const api = await importApi();
    await expect(api.listAccounts()).rejects.toThrow("unauthorized");
    expect(localStorage.getItem("wt_bearer")).toBeNull();
  });
});

describe("tokenExpiry / maybeRefresh", () => {
  it("does not call /refresh when token has plenty of time left", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const payload = btoa(JSON.stringify({ exp: futureExp }));
    const fakeJWT = `header.${payload}.sig`;
    localStorage.setItem("wt_bearer", fakeJWT);

    let refreshCalled = false;
    server.use(
      http.post(`${BASE}/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({ token: "new-token" });
      }),
      http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
    );

    const api = await importApi();
    await api.listAccounts();
    expect(refreshCalled).toBe(false);
  });

  it("calls /refresh when token expires within 30 minutes", async () => {
    const soonExp = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
    const payload = btoa(JSON.stringify({ exp: soonExp }));
    const fakeJWT = `header.${payload}.sig`;
    localStorage.setItem("wt_bearer", fakeJWT);

    let refreshCalled = false;
    server.use(
      http.post(`${BASE}/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({ token: "refreshed-jwt" });
      }),
      http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
    );

    const api = await importApi();
    await api.listAccounts();
    expect(refreshCalled).toBe(true);
    expect(localStorage.getItem("wt_bearer")).toBe("refreshed-jwt");
  });
});

describe("error propagation", () => {
  it("throws with server error message for non-401 errors", async () => {
    // 401 is intercepted early and always throws "unauthorized"; use 422 to test
    // that the server's error field is surfaced for other error codes.
    server.use(
      http.post(`${BASE}/login`, () =>
        HttpResponse.json({ error: "wrong password" }, { status: 422 }),
      ),
    );
    const api = await importApi();
    await expect(api.login("u", "bad")).rejects.toThrow("wrong password");
  });
});
