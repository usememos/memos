import { render, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_MATCH_HIGHLIGHT_NAME, useSearchMatchHighlight } from "@/components/MemoContent/useSearchMatchHighlight";

// jsdom has no CSS Custom Highlight API; a Set-backed Highlight and a Map registry are
// exactly the surface the hook uses (add/delete on the highlight, get/set on the registry).
class HighlightStub extends Set<Range> {}

const registry = new Map<string, HighlightStub>();

const paintedRanges = (): string[] => {
  const highlight = registry.get(SEARCH_MATCH_HIGHLIGHT_NAME);
  return highlight ? Array.from(highlight, (range) => range.toString()) : [];
};

const Body = ({ terms, html }: { terms: string[]; html: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useSearchMatchHighlight(ref, terms);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
};

describe("useSearchMatchHighlight", () => {
  beforeEach(() => {
    registry.clear();
    vi.stubGlobal("Highlight", HighlightStub);
    vi.stubGlobal("CSS", { highlights: registry });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers one shared highlight and paints every case-folded hit as a range", () => {
    render(<Body terms={["memo"]} html="<p>A <em>Memo</em> about memos.</p>" />);

    expect(registry.has(SEARCH_MATCH_HIGHLIGHT_NAME)).toBe(true);
    expect(paintedRanges()).toEqual(["Memo", "memo"]);
  });

  it("leaves math and SVG subtrees alone", () => {
    render(<Body terms={["x"]} html='<p>x<span class="katex">x</span><svg><text>x</text></svg></p>' />);

    expect(paintedRanges()).toEqual(["x"]);
  });

  it("does nothing without terms", () => {
    render(<Body terms={[]} html="<p>memo</p>" />);

    expect(registry.has(SEARCH_MATCH_HIGHLIGHT_NAME)).toBe(false);
  });

  it("rebuilds the ranges after the subtree changes", async () => {
    const { container } = render(<Body terms={["memo"]} html="<p>loading</p>" />);
    expect(paintedRanges()).toEqual([]);

    // Simulates an async renderer (code highlighting, a lazy link card) replacing content later.
    container.querySelector("p")!.textContent = "memo, then memo";

    await waitFor(() => expect(paintedRanges()).toEqual(["memo", "memo"]));
  });

  it("follows the search as the terms change and removes its ranges on unmount", async () => {
    const { rerender, unmount } = render(<Body terms={["alpha"]} html="<p>alpha bravo</p>" />);
    expect(paintedRanges()).toEqual(["alpha"]);

    rerender(<Body terms={["bravo"]} html="<p>alpha bravo</p>" />);
    expect(paintedRanges()).toEqual(["bravo"]);

    unmount();
    expect(paintedRanges()).toEqual([]);
  });

  it("only removes its own ranges when several bodies share the highlight", () => {
    const first = render(<Body terms={["memo"]} html="<p>first memo</p>" />);
    render(<Body terms={["memo"]} html="<p>second memo</p>" />);
    expect(paintedRanges()).toHaveLength(2);

    first.unmount();
    expect(paintedRanges()).toHaveLength(1);
  });

  it("is a no-op where the browser lacks the API", () => {
    vi.stubGlobal("CSS", {});

    expect(() => render(<Body terms={["memo"]} html="<p>memo</p>" />)).not.toThrow();
    expect(registry.size).toBe(0);
  });
});
