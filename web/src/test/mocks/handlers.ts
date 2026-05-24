import { http, HttpResponse } from "msw";
import { makeAccount, makeContact, makeAnalyticsReport } from "../fixtures";

const BASE = "/api";

export const handlers = [
  // Setup
  http.get(`${BASE}/setup/status`, () => HttpResponse.json({ hasUsers: true })),
  http.post(`${BASE}/setup/register`, () =>
    HttpResponse.json({ token: "test-jwt" }),
  ),

  // Auth
  http.post(`${BASE}/login`, () => HttpResponse.json({ token: "test-jwt" })),
  http.post(`${BASE}/refresh`, () =>
    HttpResponse.json({ token: "test-jwt-refreshed" }),
  ),

  // Accounts
  http.get(`${BASE}/accounts`, () =>
    HttpResponse.json([makeAccount({ id: 1 }), makeAccount({ id: 2 })]),
  ),
  http.post(`${BASE}/accounts/pair/qr`, () =>
    HttpResponse.json({ started: true }),
  ),
  http.post(`${BASE}/accounts/pair/phone`, () =>
    HttpResponse.json({ code: "123-456" }),
  ),
  http.patch(`${BASE}/accounts/:id`, ({ params, request: _r }) =>
    HttpResponse.json(makeAccount({ id: Number(params.id) })),
  ),
  http.delete(
    `${BASE}/accounts/:id`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Contacts
  http.get(`${BASE}/accounts/:id/contacts`, ({ params }) =>
    HttpResponse.json({
      contacts: [makeContact({ id: 1, accountId: Number(params.id) })],
      total: 1,
      page: 1,
      limit: 20,
    }),
  ),
  http.post(`${BASE}/accounts/:id/contacts/sync`, () =>
    HttpResponse.json({ synced: 5 }),
  ),
  http.post(`${BASE}/accounts/:id/contacts`, ({ params }) =>
    HttpResponse.json(makeContact({ accountId: Number(params.id) }), {
      status: 201,
    }),
  ),
  http.patch(`${BASE}/accounts/:id/contacts/:cid`, ({ params }) =>
    HttpResponse.json(
      makeContact({ id: Number(params.cid), accountId: Number(params.id) }),
    ),
  ),
  http.delete(
    `${BASE}/accounts/:id/contacts/:cid`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Timeline / Stats / Messages / Analytics
  http.get(`${BASE}/accounts/:id/contacts/:cid/timeline`, ({ params }) =>
    HttpResponse.json({
      contact: makeContact({
        id: Number(params.cid),
        accountId: Number(params.id),
      }),
      entries: [],
    }),
  ),
  http.get(`${BASE}/accounts/:id/contacts/:cid/stats`, () =>
    HttpResponse.json({
      range: "today",
      startUnix: 0,
      endUnix: 86400,
      days: [],
      onlineSecondsAll: 0,
      pictureChanges: 0,
      aboutChanges: 0,
    }),
  ),
  http.get(`${BASE}/accounts/:id/contacts/:cid/messages`, () =>
    HttpResponse.json({ messages: [], events: [] }),
  ),
  http.get(`${BASE}/accounts/:id/contacts/:cid/analytics`, () =>
    HttpResponse.json(makeAnalyticsReport()),
  ),
  http.get(`${BASE}/accounts/:id/contacts/:cid/stories`, () =>
    HttpResponse.json([]),
  ),

  // Schedule
  http.get(`${BASE}/accounts/:id/schedule`, () =>
    HttpResponse.json({ forceOffline: false, slots: [] }),
  ),
  http.put(`${BASE}/accounts/:id/schedule`, () =>
    HttpResponse.json({ forceOffline: false, slots: [] }),
  ),

  // Actions
  http.post(`${BASE}/accounts/:id/contacts/:cid/refresh-picture`, () =>
    HttpResponse.json({ started: true }),
  ),
  http.post(`${BASE}/accounts/:id/contacts/:cid/messages/fetch-history`, () =>
    HttpResponse.json({ started: true }),
  ),
  http.post(`${BASE}/accounts/:id/contacts/:cid/messages`, () =>
    HttpResponse.json({ id: "msg-1", timestamp: 1000000 }, { status: 201 }),
  ),
];
