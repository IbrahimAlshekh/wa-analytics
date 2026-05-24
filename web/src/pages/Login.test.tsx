import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/utils";
import Login from "./Login";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("Login page", () => {
  it("renders username and password fields", async () => {
    renderWithProviders(<Login />, { route: "/login" });
    await waitFor(() =>
      expect(screen.getByLabelText("auth.login.username")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("auth.login.password")).toBeInTheDocument();
  });

  it("submits credentials and stores token on success", async () => {
    let capturedBody: Record<string, string> | null = null;
    server.use(
      http.post("/api/login", async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ token: "jwt-for-test" });
      }),
    );

    renderWithProviders(<Login />, { route: "/login" });
    await waitFor(() => screen.getByLabelText("auth.login.username"));

    await userEvent.type(screen.getByLabelText("auth.login.username"), "admin");
    await userEvent.type(
      screen.getByLabelText("auth.login.password"),
      "secret",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "auth.login.submit" }),
    );

    await waitFor(() =>
      expect(localStorage.getItem("wt_bearer")).toBe("jwt-for-test"),
    );
    expect(capturedBody).toMatchObject({
      username: "admin",
      password: "secret",
    });
  });

  it("shows error message on failed login", async () => {
    server.use(
      http.post("/api/login", () => new HttpResponse(null, { status: 401 })),
    );

    renderWithProviders(<Login />, { route: "/login" });
    await waitFor(() => screen.getByLabelText("auth.login.username"));

    await userEvent.type(screen.getByLabelText("auth.login.username"), "admin");
    await userEvent.type(screen.getByLabelText("auth.login.password"), "wrong");
    await userEvent.click(
      screen.getByRole("button", { name: "auth.login.submit" }),
    );

    await waitFor(() =>
      expect(screen.getByText("unauthorized")).toBeInTheDocument(),
    );
  });
});
