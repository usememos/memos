import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MemoDetailLinkButton } from "@/components/MemoView/components/MemoHeader";

describe("<MemoDetailLinkButton>", () => {
  it("links to the memo detail page", () => {
    render(
      <MemoryRouter>
        <MemoDetailLinkButton memoName="memos/abc123" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Open memo" });
    expect(link).toHaveAttribute("href", "/memos/abc123");
  });
});
