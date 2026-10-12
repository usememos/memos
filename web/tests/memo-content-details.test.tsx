import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";

vi.mock("@/contexts/ViewContext", () => ({
  useLinkPreviewEnabled: () => true,
}));

const renderContent = (content: string) => render(<MemoMarkdownRenderer content={content} resolvedMentionUsernames={new Set()} />);

describe("memo content disclosures", () => {
  it("preserves native toggling, inline summary markup, and authored open state", () => {
    const { container } = renderContent("<details open><summary>Read <em>more</em></summary>\n\nSupporting text.\n\n</details>");
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");

    expect(details).toHaveAttribute("open");
    expect(details?.firstElementChild).toBe(summary);
    expect(summary?.querySelector("em")).toHaveTextContent("more");
    expect(summary?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Supporting text.")).toBeVisible();
    expect(container.querySelector("[node]")).toBeNull();

    fireEvent.click(summary!);
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary!);
    expect(details).toHaveAttribute("open");
  });

  it("keeps nested and sibling disclosures independent", () => {
    const { container } = renderContent(
      "<details open><summary>Outer</summary><details><summary>Inner</summary>Nested text</details></details>\n\n<details><summary>Sibling</summary>Other text</details>",
    );
    const [outer, inner, sibling] = container.querySelectorAll("details");

    fireEvent.click(screen.getByText("Inner"));
    expect(outer).toHaveAttribute("open");
    expect(inner).toHaveAttribute("open");
    expect(sibling).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Outer"));
    expect(outer).not.toHaveAttribute("open");
    expect(inner).toHaveAttribute("open");
  });

  it("keeps Markdown and bare links inside the disclosure without promoting links to preview cards", () => {
    const { container } = renderContent(
      "<details><summary>Notes</summary>\n\n- **First** point\n- Second point\n\nhttps://example.com\n\n</details>",
    );

    expect(container.querySelector("details ul li strong")).toHaveTextContent("First");
    expect(container.querySelector("details p > a")).toHaveAttribute("href", "https://example.com");
  });

  it("retains the browser fallback when a summary is omitted", () => {
    const { container } = renderContent("<details>\n\nSupporting text.\n\n</details>");

    expect(container.querySelector("details > p")).toHaveTextContent("Supporting text.");
    expect(container.querySelector("summary")).toBeNull();
  });
});
