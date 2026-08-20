import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { parser as markdownParser } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { findMarkdownTagMatches } from "@/components/MemoEditor/Editor/markdownTagRanges";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

const sourceParser = markdownParser.configure(memoMarkdownExtensions);

function inlineMath(source: string): string[] {
  const ranges: string[] = [];
  sourceParser.parse(source).iterate({
    enter(node) {
      if (node.name === "InlineMath") ranges.push(source.slice(node.from, node.to));
    },
  });
  return ranges;
}

describe("memo Markdown math", () => {
  it("keeps the issue's multiline currency list as ordinary text", () => {
    const source = `list of 10 houses
$140,000 max - buffer of ~10k
diy, add amount to down payment
no appliances covered
less than $1,000, client responsibilities
over $1,000 - owner responsibility
vacant is good to rent
for sale by owner
path to ownership -$50
rent insurance - my of`;

    expect(inlineMath(source)).toEqual([]);
  });

  it("keeps two same-line currency amounts as ordinary text", () => {
    expect(inlineMath("$20,000 and $30,000")).toEqual([]);

    const source = "$20,000 #budget and $30,000";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
    expect(findMarkdownTagMatches(state, 0, source.length).map((match) => match.value)).toEqual(["budget"]);
  });

  it("applies Pandoc-style boundaries to single-dollar inline math", () => {
    expect(inlineMath("$ x$ and $x $ and $x$2")).toEqual([]);
    expect(inlineMath("$\u0085x$ and $x\u0085$")).toEqual([]);
    expect(inlineMath("$x$, then $y$")).toEqual(["$x$", "$y$"]);
  });

  it.each([
    ["$x $ and $y$", ["$y$"]],
    ["$x$2 and $y$", ["$y$"]],
    ["$20 and $30 then $x$", ["$x$"]],
  ])("retries after an invalid exact-size closer in %s", (source, expected) => {
    expect(inlineMath(source)).toEqual(expected);
  });

  it("keeps valid and multi-dollar math opaque", () => {
    const source = "$x$ and $#hidden$ and $$#also-hidden$$, then #visible";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });

    expect(inlineMath(source)).toEqual(["$x$", "$#hidden$", "$$#also-hidden$$"]);
    expect(findMarkdownTagMatches(state, 0, source.length).map((match) => match.value)).toEqual(["visible"]);
  });
});
