import { CompletionContext } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { makeTagCompletionSource } from "@/components/MemoEditor/Editor/tagAutocomplete";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

function complete(doc: string, pos: number, tags: string[], explicit = false) {
  const source = makeTagCompletionSource(() => tags);
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
  return source(new CompletionContext(state, pos, explicit));
}

describe("tag autocomplete", () => {
  it("offers known tags after #", () => {
    const result = complete("hello #to", 9, ["todo", "today", "work"]);
    expect(result?.options.map((o) => o.label)).toEqual(["todo", "today"]);
  });

  it("returns null on a bare # with nothing typed", () => {
    expect(complete("hello #", 7, ["todo"])).toBeNull();
  });

  it("returns null when not in a tag", () => {
    expect(complete("hello world", 11, ["todo"])).toBeNull();
  });

  it("supports tags without a left boundary and hierarchical values", () => {
    expect(complete("hello#work/pr", 13, ["work", "work/private", "work/project"])?.options.map((option) => option.label)).toEqual([
      "work/private",
      "work/project",
    ]);
  });

  it("filters by the emitted value and replaces the complete source spelling", () => {
    const result = complete("#A‍B", 4, ["AB", "acorn"]);
    expect(result?.from).toBe(1);
    expect(result?.options.map((option) => option.label)).toEqual(["AB"]);
  });

  it("completes tags containing word-internal apostrophes", () => {
    const ascii = complete("#O'Br", 5, ["O'Brien", "O’Connor"]);
    expect(ascii?.from).toBe(1);
    expect(ascii?.options.map((option) => option.label)).toEqual(["O'Brien"]);

    const curly = complete("#O’Co", 5, ["O'Brien", "O’Connor"]);
    expect(curly?.from).toBe(1);
    expect(curly?.options.map((option) => option.label)).toEqual(["O’Connor"]);
  });

  it("keeps unknown character-reference shapes in literal tag source", () => {
    const source = "#R&bogus;D";
    const position = source.indexOf(";");
    expect(complete(source, position, ["R&bogus", "R&D"])?.options.map((option) => option.label)).toEqual(["R&bogus"]);
  });

  it("completes tags in GFM task items", () => {
    for (const source of ["- [ ] #ta", "- [x] #ta", "- [ ] text\n  #ta"]) {
      expect(complete(source, source.length, ["tag"])?.options.map((option) => option.label)).toEqual(["tag"]);
    }
  });

  it("uses decoded boundaries hidden by a rejected URL node", () => {
    const source = "+http://x.m/#u&#35;#va";
    expect(complete(source, source.length, ["value"])?.options.map((option) => option.label)).toEqual(["value"]);
  });

  it("does not complete in opaque syntax swallowed by a rejected URL node", () => {
    for (const source of [".https://a.b/`#code` #tail", ".https://a.b/[#link](/x) #tail", ".https://a.b/$#math$ #tail"]) {
      expect(complete(source, source.indexOf("#") + 4, ["code", "link", "math"])).toBeNull();
      expect(complete(source, source.length, ["tail"])?.options.map((option) => option.label)).toEqual(["tail"]);
    }
  });

  it("completes tags inside unresolved link-like source", () => {
    for (const source of ["[#ta][missing]", "[#ta](unterminated"]) {
      const position = source.indexOf("]");
      expect(complete(source, position, ["tag"])?.options.map((option) => option.label)).toEqual(["tag"]);
    }
  });

  it("completes tags inside unresolved second labels", () => {
    for (const source of ["[x][#tw]", "[#one][#tw]", "[x][**#tw**]"]) {
      const position = source.indexOf("tw") + 2;
      expect(complete(source, position, ["two"])?.options.map((option) => option.label)).toEqual(["two"]);
    }
    const emphasisBoundary = "[#x][#_foo_]";
    expect(complete(emphasisBoundary, emphasisBoundary.indexOf("foo") + 3, ["_foo_"])).toBeNull();
  });

  it.each([
    "[#foo@example.com][missing]",
    "[x][#foo@example.com]",
    "[#foo@example.com](unterminated",
    "![#foo@example.com][missing]",
    "[x][_#foo@example.com_]",
    "![x][_#foo@example.com_]",
  ])("does not complete inside a GFM email in unresolved link-like source: %s", (source) =>
    expect(complete(source, source.indexOf("foo") + 3, ["foo"])).toBeNull());

  it("does not complete tags inside resolved references", () => {
    const source = "[#ta][known]\n\n[known]: /path";
    expect(complete(source, source.indexOf("]"), ["tag"])).toBeNull();
  });

  it.each([
    "[a [#link](x) b][missing]",
    "[a ![#image](x) b][missing]",
  ])("does not complete inside a resolved child of an unresolved outer link: %s", (source) =>
    expect(complete(source, source.indexOf("#") + 4, ["link", "image"])).toBeNull());

  it("fails closed while a distant reference definition is not parsed yet", () => {
    const source = `[#ta][known]\n\n${"x".repeat(120_000)}\n\n[known]: /path`;
    expect(complete(source, source.indexOf("]"), ["tag"])).toBeNull();
  });

  it("follows keycap candidate enumeration", () => {
    expect(complete("#️⃣", 3, ["#️⃣"])).toBeNull();
    const result = complete("##️⃣", 4, ["#️⃣"]);
    expect(result?.from).toBe(1);
    expect(result?.options.map((option) => option.label)).toEqual(["#️⃣"]);
  });

  it.each([
    ["`#to`", 4],
    ["[#to](https://example.com)", 4],
    ["https://example.com/#to", 23],
    ["\\#to", 4],
    ["&#35;to", 7],
    ["$#to$", 4],
    ["$#to\\$", 4],
    ["$$meta\n#to", 10],
  ])("returns null in opaque Markdown source: %s", (doc, position) => expect(complete(doc, position, ["todo"])).toBeNull());

  it("matches escaped-dollar and mismatched-run math boundaries", () => {
    expect(complete("$\\$#ta$", 6, ["tag"])?.options.map((option) => option.label)).toEqual(["tag"]);
    expect(complete("$$#ta$", 5, ["tag"])?.options.map((option) => option.label)).toEqual(["tag"]);
  });

  it("keeps recognized URL suffixes opaque without hiding invalid-domain tags", () => {
    const url = "http://example.com#z";
    const bomURL = "\uFEFFhttp://example.com#z";
    const doubleBOMURL = "\uFEFF\uFEFFhttp://example.com#z";
    const midDocumentBOMURL = "before\n\n\uFEFFhttp://example.com#z";
    const invalidDomain = "https://foo.example_/#vi";

    expect(complete(url, url.length, ["zebra"])).toBeNull();
    expect(complete(bomURL, bomURL.length, ["zebra"])).toBeNull();
    expect(complete(doubleBOMURL, doubleBOMURL.length, ["zebra"])?.options.map((option) => option.label)).toEqual(["zebra"]);
    expect(complete(midDocumentBOMURL, midDocumentBOMURL.length, ["zebra"])?.options.map((option) => option.label)).toEqual(["zebra"]);
    expect(complete(invalidDomain, invalidDomain.length, ["visible"])?.options.map((option) => option.label)).toEqual(["visible"]);
  });

  it("keeps recognized Unicode-domain URL suffixes opaque", () => {
    const protocolURL = "https://點看.com/#work";
    const wwwURL = "www.點看.com/#work";
    const validPrefixedSegment = "https://a_b.點看.com/#work";
    const invalidPenultimateSegment = "https://foo_bar.點看/#work";
    const missingBoundary = "hellohttps://點看.com/#work";

    expect(complete(protocolURL, protocolURL.length, ["work"])).toBeNull();
    expect(complete(wwwURL, wwwURL.length, ["work"])).toBeNull();
    expect(complete(validPrefixedSegment, validPrefixedSegment.length, ["work"])).toBeNull();
    expect(complete(invalidPenultimateSegment, invalidPenultimateSegment.length, ["work"])?.options.map((option) => option.label)).toEqual([
      "work",
    ]);
    expect(complete(missingBoundary, missingBoundary.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
  });

  it("uses GFM protocol and www boundaries for Unicode-domain URLs", () => {
    for (const url of ["1https://點看.com/#work", ".https://點看.com/#work", "]www.點看.com/#work", "中https://點看.com/#work"]) {
      expect(complete(url, url.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
    }

    const joined = "hellohttps://點看.com/#work";
    expect(complete(joined, joined.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
  });

  it("keeps URLs blocked by unbalanced brackets tag-eligible", () => {
    for (const url of ["[https://點看.com/#work", "[www.點看.com/#work"]) {
      expect(complete(url, url.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
    }
    for (const url of ["\\[https://點看.com/#work", "\\[www.點看.com/#work"]) {
      expect(complete(url, url.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
    }
  });

  it.each([
    "[ https://example.com/#hidden]",
    "[x https://example.com/#hidden]",
    "![ https://example.com/#hidden]",
  ])("does not complete in a GFM URL inside unresolved bracket text: %s", (source) =>
    expect(complete(source, source.indexOf("hidden") + "hidden".length, ["hidden"])).toBeNull());

  it("uses one explicit separator class for written URLs", () => {
    for (const source of [
      "https://點看.com/\u00a0#work",
      "https://點看.com/\u2003#work",
      "https://點看.com/\u000b#work",
      "https://點看.com/\u2028#work",
      "https://點看.com/\u2029#work",
    ]) {
      expect(complete(source, source.length, ["work"])?.options.map((option) => option.label)).toEqual(["work"]);
    }
    const nelURL = "https://點看.com/\u0085#work";
    expect(complete(nelURL, nelURL.length, ["work"])).toBeNull();
  });

  it("uses reconciled GFM email ranges for completion", () => {
    const escapedPlus = "#foo\\+bar@example.com";
    const escapedUnderscore = "#next\\_item@example.com";
    const invalidSuffix = "#foo/bar@example.com_";

    expect(complete(escapedPlus, 4, ["foo"])).toBeNull();
    expect(complete(escapedUnderscore, 5, ["next"])).toBeNull();
    expect(complete(invalidSuffix, 8, ["foo/bar"])?.options.map((option) => option.label)).toEqual(["foo/bar"]);
  });

  it.each([
    "#foo&#46;bar@example.com",
    "#foo&period;bar@example.com",
    "#foo&#64;example.com",
  ])("does not complete inside a GFM email joined by a known entity: %s", (source) => expect(complete(source, 4, ["foo"])).toBeNull());

  it("offers all tags on explicitly completed bare introducer", () => {
    expect(complete("hello #", 7, ["todo", "work"], true)?.options.map((option) => option.label)).toEqual(["todo", "work"]);
  });

  it("does not treat a keycap emoji hash as an explicit bare introducer", () => {
    expect(complete("#️⃣", 1, ["todo"], true)).toBeNull();
    expect(complete("##️⃣", 2, ["todo"], true)).toBeNull();
    expect(complete("#first#️⃣", 7, ["todo"], true)).toBeNull();
  });
});
