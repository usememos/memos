import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MemoDetailLinkButton } from "@/components/MemoView/components/MemoHeader";

const LocationState = () => {
  const location = useLocation();
  return <span data-testid="from">{location.state?.from}</span>;
};

describe("<MemoDetailLinkButton>", () => {
  it("links to the memo detail page with parent page state", () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={<MemoDetailLinkButton ariaLabel="Open Memo" memoName="memos/abc123" parentPage="/explore" />}
          />
          <Route path="/memos/abc123" element={<LocationState />} />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Open Memo" });
    expect(link).toHaveAttribute("href", "/memos/abc123");

    fireEvent.click(link);
    expect(screen.getByTestId("from")).toHaveTextContent("/explore");
  });
});
