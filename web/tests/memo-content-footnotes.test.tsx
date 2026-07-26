import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MemoMarkdownRendererCore } from "@/components/MemoContent/MemoMarkdownRenderer";

const FOOTNOTE_MARKDOWN = "A statement with a note.[^1]\n\n[^1]: The footnote body.";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.hash}`}</output>;
};

const renderFootnote = (compact = false) =>
  render(
    <MemoryRouter>
      <div data-memo-content>
        <MemoMarkdownRendererCore
          content={FOOTNOTE_MARKDOWN}
          resolvedMentionUsernames={new Set()}
          memoName="memos/abc123"
          compact={compact}
        />
      </div>
      <LocationProbe />
    </MemoryRouter>,
  );

describe("memo footnotes", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    if (!globalThis.CSS) {
      Object.defineProperty(globalThis, "CSS", { configurable: true, value: {} });
    }
    if (!globalThis.CSS.escape) {
      globalThis.CSS.escape = (value: string) => value;
    }
  });

  it("keeps GFM footnote references aligned with their sanitized target ids", () => {
    const { container } = renderFootnote();

    const reference = container.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");
    const target = container.querySelector<HTMLElement>("#user-content-fn-1");

    expect(reference).not.toBeNull();
    expect(reference).toHaveAttribute("href", "/memos/abc123#user-content-fn-1");
    expect(target).not.toBeNull();
    expect(container.querySelector("#user-content-user-content-fn-1")).toBeNull();
  });

  it("scrolls to a footnote inside the same fully rendered memo", () => {
    const { container } = renderFootnote();
    const reference = container.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");
    const target = container.querySelector<HTMLElement>("#user-content-fn-1");
    const scrollIntoView = vi.fn();
    target!.scrollIntoView = scrollIntoView;

    fireEvent.click(reference!);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("navigates compact cards to the memo detail footnote", () => {
    const { container } = renderFootnote(true);
    const reference = container.querySelector<HTMLAnchorElement>("a[data-footnote-ref]");

    fireEvent.click(reference!);

    expect(screen.getByTestId("location")).toHaveTextContent("/memos/abc123#user-content-fn-1");
  });
});
