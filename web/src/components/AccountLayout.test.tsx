import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../test/utils";
import AccountLayout from "./AccountLayout";

// Route wrapper needed so useParams() receives the :id segment
function RoutedAccountLayout() {
  return (
    <Routes>
      <Route path="/accounts/:id" element={<AccountLayout />} />
    </Routes>
  );
}

describe("AccountLayout", () => {
  it("renders the sidebar contact list from the API", async () => {
    renderWithProviders(<RoutedAccountLayout />, { route: "/accounts/1" });
    // Default MSW handler returns makeContact({ id: 1 }) → displayName "Contact 1"
    await waitFor(() =>
      expect(screen.getByText("Contact 1")).toBeInTheDocument(),
    );
  });

  it("marks no contact as active when no cid in URL", async () => {
    renderWithProviders(<RoutedAccountLayout />, { route: "/accounts/1" });
    await waitFor(() => screen.getByText("Contact 1"));
    // The contact link exists and is not broken
    const link = screen.getByRole("link", { name: /Contact 1/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/accounts/1/contacts/1"),
    );
  });
});
