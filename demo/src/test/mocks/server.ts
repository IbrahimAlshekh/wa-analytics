import { setupServer } from "msw/node";

// Demo's api.ts uses in-process mocks (no HTTP), so no handlers are needed.
// The server is still created so tests can optionally intercept if needed.
export const server = setupServer();
