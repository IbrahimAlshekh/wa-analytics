import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./test/utils";
import { installMockWebSocket } from "./test/mocks/websocket";
import { useStore } from "./lib/store";
import type { WSEnvelope } from "@/types/ws";
import App from "./App";

// ws.ts maintains module-level singleton state (socket, reconnectTimer).
// Use 4001 close in afterEach: it nulls ws.socket without scheduling a
// reconnect, so the next test's ws.start() creates a fresh socket.
let mock: ReturnType<typeof installMockWebSocket>;

beforeEach(() => {
  mock = installMockWebSocket();
  localStorage.setItem("wt_bearer", "test-token");
  useStore.setState({ token: "test-token" });
});

afterEach(() => {
  // 4001 → ws.socket = null, no reconnect timer scheduled
  try {
    mock.latest().triggerClose(4001, "test teardown");
  } catch {
    // No socket was created (e.g. ws.start skipped)
  }
  mock.restore();
  localStorage.clear();
  useStore.setState({ token: null });
  vi.clearAllTimers();
});

describe("App — rendering", () => {
  it("renders header and accounts page when authenticated", async () => {
    renderWithProviders(<App />, { route: "/" });
    // AppHeader renders t("app.name") when not on a public path
    await waitFor(() =>
      expect(screen.getByText("app.name")).toBeInTheDocument(),
    );
  });

  it("does not render app header on login page", async () => {
    useStore.setState({ token: null });
    renderWithProviders(<App />, { route: "/login" });
    await waitFor(() =>
      expect(screen.getByLabelText("auth.login.username")).toBeInTheDocument(),
    );
    expect(screen.queryByText("app.name")).not.toBeInTheDocument();
  });
});

describe("App — WebSocket integration", () => {
  it("invalidates timeline query when a presence message arrives", async () => {
    const { queryClient } = renderWithProviders(<App />, { route: "/" });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    // ws.start() fires in the mount effect; socket is now in CONNECTING state
    mock.latest().triggerOpen();

    const msg: WSEnvelope = {
      type: "presence",
      accountId: 1,
      contactId: 2,
      jid: "491712@s.whatsapp.net",
      state: "available",
      observedAt: Math.floor(Date.now() / 1000),
    };
    mock.latest().triggerMessage(msg);

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["timeline", 1, 2] }),
      ),
    );
  });

  it("invalidates accounts query when auth.linked message arrives", async () => {
    const { queryClient } = renderWithProviders(<App />, { route: "/" });
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    mock.latest().triggerOpen();

    const msg: WSEnvelope = {
      type: "auth.linked",
      accountID: 5,
      ownJID: "5@s.whatsapp.net",
    };
    mock.latest().triggerMessage(msg);

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["accounts"] }),
      ),
    );
  });
});
