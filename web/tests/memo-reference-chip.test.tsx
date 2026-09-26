import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MemoMarkdownRendererCore } from "@/components/MemoContent/MemoMarkdownRenderer";

const renderContent = (content: string, parentPage?: string) =>
  render(
    <MemoryRouter>
      <MemoMarkdownRendererCore content={content} resolvedMentionUsernames={new Set()} memoName="memos/self" parentPage={parentPage} />
    </MemoryRouter>,
  );

describe("inline memo reference rendering", () => {
  it("renders a root-relative memo link as an in-app chip", () => {
    renderContent("See [Memos](/memos/abc123) for context.");

    const chip = screen.getByRole("link", { name: "Memos" });
    expect(chip).toHaveAttribute("href", "/memos/abc123");
    expect(chip).toHaveAttribute("data-memo-reference", "/memos/abc123");
    // An in-app route, not an exit: no new tab.
    expect(chip).not.toHaveAttribute("target");
  });

  it("keeps the author's own label", () => {
    renderContent("[last week's retro](/memos/abc123)");
    expect(screen.getByRole("link", { name: "last week's retro" })).toHaveAttribute("href", "/memos/abc123");
  });

  it("still opens an ordinary link in a new tab", () => {
    renderContent("[docs](https://example.com/memos/abc123)");

    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).not.toHaveAttribute("data-memo-reference");
  });
});
