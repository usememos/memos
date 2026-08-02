import { parser as markdownParser } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { findGFMEmailMatches, findMarkdownGFMEmailRanges, type MarkdownSourceNode } from "@/utils/gfm-email";
import { resolvedMarkdownLinkRanges } from "@/utils/markdown-link";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

describe("GFM email source ranges", () => {
  const range = (from: number, to: number, value: string) => ({ from, to, value });
  const sourceParser = markdownParser.configure(memoMarkdownExtensions);

  it.each([
    ["#foo/bar_baz@example.com", [range(5, 24, "bar_baz@example.com")]],
    ["#foo\\+bar@example.com", [range(1, 21, "foo+bar@example.com")]],
    ["#next\\_item@example.com", [range(1, 23, "next_item@example.com")]],
    ["#foo&#46;bar@example.com", [range(1, 24, "foo.bar@example.com")]],
    ["#foo&period;bar@example.com", [range(1, 27, "foo.bar@example.com")]],
    ["#foo&#64;example.com", [range(1, 20, "foo@example.com")]],
    ["#foo&bogus;bar@example.com", [range(11, 26, "bar@example.com")]],
    ["#foo!bar@example.com", [range(5, 20, "bar@example.com")]],
    ["foo@bar.com@baz.example", [range(0, 11, "foo@bar.com")]],
    ["foo@bar.com+abc@def.com", [range(0, 11, "foo@bar.com"), range(11, 23, "+abc@def.com")]],
    ["mail@example.com.", [range(0, 16, "mail@example.com")]],
    ["mail@example.com_", []],
    ["mail@example.com-", []],
    ["mail@example.c_m", [range(0, 16, "mail@example.c_m")]],
    ["mail@example.c_", []],
    ["😀foo@example.com", [range(2, 17, "foo@example.com")]],
    ["(mail@example.com", [range(1, 17, "mail@example.com")]],
  ])("matches canonical ranges in %s", (source, expected) => {
    expect(findGFMEmailMatches(source)).toEqual(expected);
  });

  it.each([
    ["[x][_#foo@example.com_]", [range(6, 21, "foo@example.com")]],
    ["![x][_#foo@example.com_]", [range(7, 22, "foo@example.com")]],
    ["[x][`#foo@example.com`]", []],
  ])("reparses unresolved second-label Markdown in %s", (source, expected) => {
    const root = sourceParser.parse(source).topNode as MarkdownSourceNode;

    expect(findMarkdownGFMEmailRanges(source, root, resolvedMarkdownLinkRanges(source, root), true)).toEqual(expected);
  });
});
