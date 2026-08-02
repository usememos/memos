import { markdown } from "@codemirror/lang-markdown";
import { forceParsing } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { findMarkdownMentionMatches, findMarkdownTagMatches } from "@/components/MemoEditor/Editor/markdownTagRanges";
import { tagMentionDecorations } from "@/components/MemoEditor/Editor/tagMentionDecorations";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

function countClass(doc: string, cls: string): number {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdown({ extensions: memoMarkdownExtensions }), tagMentionDecorations] }),
    parent: document.body,
  });
  forceParsing(view, view.state.doc.length, 1000);
  const n = view.dom.querySelectorAll(`.${cls}`).length;
  view.destroy();
  return n;
}

describe("tag/mention decorations", () => {
  it("decorates #tags", () => expect(countClass("a #todo and #work/sub b", "cm-memo-tag")).toBe(2));
  it("does not require a left boundary", () => expect(countClass("hello#tag 中文#标签", "cm-memo-tag")).toBe(2));
  it("keeps apostrophes only inside XID words", () => {
    const source = "#tag's #сім'я #O’Brien '#quoted' #users' #'missing";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
    expect(findMarkdownTagMatches(state, 0, source.length).map(({ source, value }) => ({ source, value }))).toEqual([
      { source: "tag's", value: "tag's" },
      { source: "сім'я", value: "сім'я" },
      { source: "O’Brien", value: "O’Brien" },
      { source: "quoted", value: "quoted" },
      { source: "users", value: "users" },
    ]);
  });
  it("uses emitted spans for ignored characters and emoji", () =>
    expect(countClass("#A‍B #́foo #foo/́bar #👩‍💻 #️⃣ ##️⃣", "cm-memo-tag")).toBe(5));
  it("keeps maximal valid prefixes and adjacent tags", () =>
    expect(countClass("#book/ #book//fiction #first#second ##tag", "cm-memo-tag")).toBe(5));
  it("does not cross formatting syntax boundaries", () => expect(countClass("#_foo_ **#urgent**", "cm-memo-tag")).toBe(1));
  it("does not decorate tags in opaque Markdown source", () =>
    expect(
      countClass("`#code` [#label](https://example.com/#link) https://example.com/#url \\#escaped &#35;entity #ok", "cm-memo-tag"),
    ).toBe(1));
  it("keeps unknown character-reference shapes in literal tag source", () =>
    expect(countClass("#R&bogus;D #Q&amp;&bogus;D", "cm-memo-tag")).toBe(2));
  it("supplements decoded source boundaries hidden by broad parser nodes", () => {
    expect(countClass("+http://x.m/#u&#35;#v +http://x.m/#w\\|", "cm-memo-tag")).toBe(3);
    expect(countClass("#a&CounterClockwiseContourIntegral;b#c", "cm-memo-tag")).toBe(2);
  });
  it.each([
    ".https://a.b/`#code` #tail",
    ".https://a.b/[#link](/x) #tail",
    ".https://a.b/![#image](/x) #tail",
    ".https://a.b/$#math$ #tail",
  ])("reparses opaque syntax swallowed by a rejected URL node: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(1));
  it("projects emphasis closed inside a rejected URL node", () => {
    const source = "_[http://x.m/#v_>";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
    expect(findMarkdownTagMatches(state, 0, source.length)).toEqual([{ from: 13, to: 15, source: "v", value: "v" }]);
  });
  it("coalesces literal source across a rejected URL node", () => {
    for (const [source, value] of [
      ["#http://x.y/", "http"],
      ["#www.x.y/", "www"],
      ["#b-www.x.y/", "b-www"],
    ]) {
      const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
      expect(findMarkdownTagMatches(state, 0, source.length).map((match) => match.value)).toEqual([value]);
    }
  });
  it("treats a rejected link reference definition as ordinary text", () => {
    expect(countClass("[#-]:(", "cm-memo-tag")).toBe(1);
    expect(countClass("[#use][bad]\n\n[bad]:(", "cm-memo-tag")).toBe(1);
    expect(countClass("[#foo@example.com]:(", "cm-memo-tag")).toBe(0);
    expect(countClass("[ https://example.com/#hidden]:(", "cm-memo-tag")).toBe(0);
  });
  it("follows CommonMark tab expansion inside blockquotes", () => {
    expect(countClass(">\t #a", "cm-memo-tag")).toBe(1);
    expect(countClass("  >\t   #a", "cm-memo-tag")).toBe(1);
    expect(countClass(" >\t  #a", "cm-memo-tag")).toBe(1);
    expect(countClass("- >\t   #a", "cm-memo-tag")).toBe(1);
    expect(countClass(">\t  #a", "cm-memo-tag")).toBe(0);
  });
  it.each(["- [ ] #a", "- [x] #a", "- [ ] #a\n  #b"])("decorates tags in a GFM task item: %s", (source) =>
    expect(countClass(source, "cm-memo-tag")).toBe(source.includes("#b") ? 2 : 1));
  it("keeps GFM URLs and emails opaque in task items", () =>
    expect(countClass("- [ ] https://example.com/#url #foo@example.com #tag", "cm-memo-tag")).toBe(1));
  it("keeps the exact value and range before an unknown entity semicolon", () => {
    const source = "#R&bogus;D";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });

    expect(findMarkdownTagMatches(state, 0, source.length)).toEqual([{ from: 0, to: 8, source: "R&bogus", value: "R&bogus" }]);
  });
  it("decorates tags inside unresolved link-like source", () =>
    expect(countClass("[#tag][missing] [#other](unterminated", "cm-memo-tag")).toBe(2));
  it("decorates tags in both labels when a reference does not resolve", () => {
    expect(countClass("[x][#two]", "cm-memo-tag")).toBe(1);
    expect(countClass("[#one][#two]", "cm-memo-tag")).toBe(2);
    expect(countClass("[x][**#two**]", "cm-memo-tag")).toBe(1);
    expect(countClass("[#x][#_foo_]", "cm-memo-tag")).toBe(1);
  });
  it.each([
    "[#foo@example.com][missing]",
    "[x][#foo@example.com]",
    "[#foo@example.com](unterminated",
    "![#foo@example.com][missing]",
    "[x][_#foo@example.com_]",
    "![x][_#foo@example.com_]",
  ])("keeps GFM emails opaque inside unresolved link-like source: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(0));
  it("reparses all Markdown boundaries in unresolved second labels", () => {
    expect(countClass("[x][<#foo@example.com>] ![x][<https://example.com/#foo>]", "cm-memo-tag")).toBe(0);
    expect(countClass("[x][\\#escaped #real] ![x][&#35;escaped #other]", "cm-memo-tag")).toBe(2);
    expect(countClass("[x][#R&amp;D #real]", "cm-memo-tag")).toBe(2);
    expect(countClass("[x][https://example.com/#foo] ![x][https://example.com/#bar]", "cm-memo-tag")).toBe(2);
  });
  it.each(["\n", "\r", "\r\n"])("deduplicates a %j boundary in an unresolved second label", (lineEnding) =>
    expect(countClass(`[#a][${lineEnding}]${lineEnding}${lineEnding}[#a]: /x`, "cm-memo-tag")).toBe(1));
  it("keeps resolved reference and inline links opaque", () =>
    expect(countClass("[#reference][known] [#inline](/path)\n\n[known]: /path", "cm-memo-tag")).toBe(0));
  it.each([
    "[a [#link](x) b][missing]",
    "[a ![#image](x) b][missing]",
  ])("keeps a resolved child opaque inside an unresolved outer link: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(0));
  it("fails closed while a distant reference definition is not parsed yet", () => {
    const source = `[#hidden][known]\n\n${"x".repeat(120_000)}\n\n[known]: /path`;
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });

    expect(findMarkdownTagMatches(state, 0, 18)).toEqual([]);
  });
  it("uses CommonMark identifier normalization when resolving reference links", () => {
    expect(countClass("[#hidden][ẞ]\n\n[SS]: /path", "cm-memo-tag")).toBe(0);
    expect(countClass("[#hidden][a\0b]\n\n[a�b]: /path", "cm-memo-tag")).toBe(0);
    expect(countClass("[#visible][\u00a0ref]\n\n[ref]: /path", "cm-memo-tag")).toBe(1);
  });
  it("follows written-GFM URL domain boundaries", () =>
    expect(
      countClass("https://example.COM/#hidden https://a_b.foo.example/路径#also-hidden https://foo_bar.example/#visible", "cm-memo-tag"),
    ).toBe(1));
  it("keeps written GFM URLs with Unicode domains opaque", () =>
    expect(
      countClass(
        "https://點看.com/#hidden www.點看.com/#also-hidden https://a_b.點看.com/#still-hidden " +
          "https://foo_bar.點看/#visible https://點看.com_/#suffix hellohttps://點看.com/#joined",
        "cm-memo-tag",
      ),
    ).toBe(3));
  it("uses GFM protocol and www boundaries for Unicode domains", () =>
    expect(
      countClass(
        "1https://點看.com/#digit .https://點看.com/#punctuation ]www.點看.com/#www " +
          "中https://點看.com/#unicode hellohttps://點看.com/#joined",
        "cm-memo-tag",
      ),
    ).toBe(5));
  it("keeps URLs blocked by unbalanced brackets tag-eligible", () =>
    expect(
      countClass(
        "[https://點看.com/#protocol\n\n[www.點看.com/#www\n\n\\[https://點看.com/#escaped\n\n\\[www.點看.com/#escaped-www",
        "cm-memo-tag",
      ),
    ).toBe(4));
  it("keeps a URL later in unresolved bracket text opaque", () =>
    expect(countClass("[text https://點看.com/#inside\n\n[more https://example.com/#ascii", "cm-memo-tag")).toBe(0));
  it.each([
    "[ https://example.com/#hidden]",
    "[x https://example.com/#hidden]",
    "![ https://example.com/#hidden]",
  ])("follows GFM URL boundaries inside unresolved bracket text: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(0));
  it("uses one explicit separator class for written URLs", () =>
    expect(
      countClass(
        "https://點看.com/\u00a0#nbsp https://點看.com/\u2003#em-space https://點看.com/\u000b#vertical-tab " +
          "https://點看.com/\u2028#line-separator https://點看.com/\u2029#paragraph-separator https://點看.com/\u0085#nel-hidden",
        "cm-memo-tag",
      ),
    ).toBe(5));
  it.each([
    "`[` https://example.com/#hidden",
    "$[$ https://example.com/#hidden",
    '<span data-x="[">x</span> https://example.com/#hidden',
    "<https://x.example/[> https://example.com/#hidden",
  ])("ignores brackets in earlier opaque syntax when classifying a URL: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(0));
  it("keeps the complete suffix of a recognized GFM URL opaque", () => {
    expect(countClass("http://example.com#z", "cm-memo-tag")).toBe(0);
    expect(countClass("https://foo.example_/#visible", "cm-memo-tag")).toBe(1);
    expect(countClass("\uFEFFhttp://example.com#hidden #shown", "cm-memo-tag")).toBe(1);
    expect(countClass("before\n\n\uFEFFhttp://example.com#shown", "cm-memo-tag")).toBe(1);
    expect(countClass("\uFEFF\uFEFFhttp://example.com#shown", "cm-memo-tag")).toBe(1);
  });
  it.each([
    "#foo/bar_baz@example.com",
    "#next/item_@example.com",
    "_foo@example.com #tag_",
  ])("follows complete GFM email ranges: %s", (doc) => expect(countClass(doc, "cm-memo-tag")).toBe(1));
  it("decodes escapes while reconciling repeated and adjacent GFM email ranges", () => {
    expect(countClass("#foo\\+bar@example.com #next\\_item@example.com", "cm-memo-tag")).toBe(0);
    expect(countClass("#foo\\+bar@example.com #next\\_item@example.com", "cm-memo-mention")).toBe(0);
    expect(countClass("foo@bar.com@baz.example foo@bar.com+abc@def.com", "cm-memo-mention")).toBe(0);
  });
  it.each([
    "#foo&#46;bar@example.com",
    "#foo&period;bar@example.com",
    "#foo&#64;example.com",
  ])("decodes known entities before reconciling a GFM email: %s", (source) => expect(countClass(source, "cm-memo-tag")).toBe(0));
  it("keeps invalid email suffixes tag-eligible and slash-separated locals visible", () => {
    expect(countClass("#foo/bar@example.com_", "cm-memo-tag")).toBe(1);
    expect(countClass("#next/item_@example.com", "cm-memo-mention")).toBe(0);
  });
  it("does not decorate inline or block dollar math", () =>
    expect(countClass("$#inline$\n\n$$\n#block\n$$\n\n#ok", "cm-memo-tag")).toBe(1));
  it("treats dollar signs after an inline opener as math delimiters even when preceded by a backslash", () => {
    expect(countClass("$#math\\$", "cm-memo-tag")).toBe(0);
    expect(countClass("$\\$#tag$", "cm-memo-tag")).toBe(1);
  });
  it("does not retry inside an unmatched dollar run", () => expect(countClass("$$#tag$", "cm-memo-tag")).toBe(1));
  it.each(["$$\n#block", "$$meta\n#block"])("keeps unclosed flow math opaque: %s", (doc) => expect(countClass(doc, "cm-memo-tag")).toBe(0));
  it("keeps flow math scoped to its list or blockquote", () => {
    expect(countClass("> $$\n> #math\noutside #tag", "cm-memo-tag")).toBe(1);
    expect(countClass("- $$\n  #math\noutside #tag", "cm-memo-tag")).toBe(1);
  });
  it("matches flow fence lengths and rejects dollar signs in metadata", () => {
    expect(countClass("$$$\n#math\n$$$\n#ok", "cm-memo-tag")).toBe(1);
    expect(countClass("$$meta$x\n#tag", "cm-memo-tag")).toBe(1);
  });
  it("allows flow math to interrupt a paragraph", () => expect(countClass("text\n$$\n#math", "cm-memo-tag")).toBe(0));
  it("does not let same-line math hide following text", () => expect(countClass("$$#inline$$\n#ok", "cm-memo-tag")).toBe(1));
  it("allows ordinary text between inline HTML tags", () => expect(countClass("<span>#inside</span>", "cm-memo-tag")).toBe(1));
  it("decorates writable username references", () =>
    expect(countClass("@alice @Alice-2 @1alice @a--b @123 @123-456", "cm-memo-mention")).toBe(6));
  it("rejects invalid username shapes", () => expect(countClass("@-alice @alice- @álîçé", "cm-memo-mention")).toBe(0));
  it("applies mention boundaries to source text", () =>
    expect(countClass("hello@alice foo-@bob foo_@carol 中文@dave (@erin) @frank@grace", "cm-memo-mention")).toBe(4));
  it("decorates mentions in transparent formatting", () => expect(countClass("**@Alice** ~~@bob~~ _@carol_", "cm-memo-mention")).toBe(3));
  it("keeps mentions in opaque Markdown source undecorated", () =>
    expect(
      countClass("`@code` [@link](/x) ![@image](/x) https://example.com/@url $@math$ \\@escaped &#64;entity @ok", "cm-memo-mention"),
    ).toBe(1));
  it("keeps GFM emails opaque and does not cross their source boundary", () =>
    expect(countClass("@alice@example.com foo@bar.com@bob @ok", "cm-memo-mention")).toBe(1));
  it("returns the exact mention source range and username", () => {
    const source = "x @Alice-2.";
    const state = EditorState.create({ doc: source, extensions: [markdown({ extensions: memoMarkdownExtensions })] });

    expect(findMarkdownMentionMatches(state, 0, source.length)).toEqual([{ from: 2, to: 10, username: "Alice-2" }]);
  });
});
