import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";
import { useDateFilterNavigation } from "@/hooks/useDateFilterNavigation";

const Harness = () => {
  const location = useLocation();
  const navigateToDate = useDateFilterNavigation();
  return (
    <>
      <output data-testid="search">{location.search}</output>
      <button type="button" onClick={() => navigateToDate("2026-08-02")}>
        Select date
      </button>
    </>
  );
};

describe("useDateFilterNavigation", () => {
  it("preserves unrelated query parameters while replacing the date filter", async () => {
    render(
      <MemoryRouter initialEntries={["/u/steven?view=map&filter=tagSearch%3Awork"]}>
        <MemoFilterProvider>
          <Harness />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select date" }));

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("search").textContent ?? "");
      expect(params.get("view")).toBe("map");
      expect(params.get("filter")).toContain("tagSearch:work");
      expect(params.get("filter")).toContain("displayTime:2026-08-02");
    });
  });
});
