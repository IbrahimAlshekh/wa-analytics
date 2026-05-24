import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { renderWithProviders } from "../test/utils";
import Register from "./Register";

beforeEach(() => {
  localStorage.clear();
  // Override to indicate no users yet so Register doesn't redirect to /login
  server.use(
    http.get("/api/setup/status", () => HttpResponse.json({ hasUsers: false })),
  );
});
afterEach(() => localStorage.clear());

describe("Register page", () => {
  it("renders all form fields", async () => {
    renderWithProviders(<Register />, { route: "/register" });
    await waitFor(() =>
      expect(
        screen.getByLabelText("auth.register.username"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("auth.register.password")).toBeInTheDocument();
    expect(
      screen.getByLabelText("auth.register.confirmPassword"),
    ).toBeInTheDocument();
  });

  it("registers and stores token on success", async () => {
    let capturedBody: Record<string, string> | null = null;
    server.use(
      http.post("/api/setup/register", async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, string>;
        return HttpResponse.json({ token: "reg-jwt" });
      }),
    );

    renderWithProviders(<Register />, { route: "/register" });
    await waitFor(() => screen.getByLabelText("auth.register.username"));

    await userEvent.type(
      screen.getByLabelText("auth.register.username"),
      "newuser",
    );
    await userEvent.type(
      screen.getByLabelText("auth.register.password"),
      "strongpass",
    );
    await userEvent.type(
      screen.getByLabelText("auth.register.confirmPassword"),
      "strongpass",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "auth.register.submit" }),
    );

    await waitFor(() =>
      expect(localStorage.getItem("wt_bearer")).toBe("reg-jwt"),
    );
    expect(capturedBody).toMatchObject({
      username: "newuser",
      password: "strongpass",
    });
  });

  it("shows error when passwords do not match", async () => {
    renderWithProviders(<Register />, { route: "/register" });
    await waitFor(() => screen.getByLabelText("auth.register.username"));

    await userEvent.type(
      screen.getByLabelText("auth.register.username"),
      "user",
    );
    await userEvent.type(
      screen.getByLabelText("auth.register.password"),
      "pass1",
    );
    await userEvent.type(
      screen.getByLabelText("auth.register.confirmPassword"),
      "pass2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "auth.register.submit" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("auth.register.passwordMismatch"),
      ).toBeInTheDocument(),
    );
  });
});
