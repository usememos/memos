import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkCurrencySafeMath } from "@/utils/remark-plugins/remark-currency-safe-math";
import { remarkMemoSyntax } from "@/utils/remark-plugins/remark-tag";

const renderMarkdown = (content: string): string =>
  renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkCurrencySafeMath, remarkGfm, remarkMemoSyntax, remarkBreaks]}>{content}</ReactMarkdown>,
  );

const renderMarkdownWithoutMath = (content: string): string =>
  renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm, remarkMemoSyntax, remarkBreaks]}>{content}</ReactMarkdown>);

describe("remarkMemoSyntax", () => {
  it("does not turn URL fragments inside autolinks into tags", () => {
    const html = renderMarkdown("https://github.com/dmtrKovalenko/fff#pi-agent-extension\n\nProject #memo-tag");

    expect(html).toContain('href="https://github.com/dmtrKovalenko/fff#pi-agent-extension"');
    expect(html).not.toContain('data-tag="pi-agent-extension"');
    expect(html).toContain('data-tag="memo-tag"');
  });

  it("uses written GFM URL nodes as the opaque boundary", () => {
    const html = renderMarkdown("https://example.com/#hidden https://localhost/#local HTTP://example.com/#upper ftp://example.com/#ftp");

    expect(html).not.toContain('data-tag="hidden"');
    expect(html).toContain('data-tag="local"');
    expect(html).toContain('data-tag="upper"');
    expect(html).toContain('data-tag="ftp"');
  });

  it("keeps complete written-GFM link suffixes opaque", () => {
    const html = renderMarkdown("x https://example.com/%#&_; http://example.com#z\n\nhttps://foo.example_/#suffix #ok");

    expect(html).not.toContain('data-tag="&amp;"');
    expect(html).not.toContain('data-tag="z"');
    expect(html).toContain('data-tag="suffix"');
    expect(html).toContain('data-tag="ok"');
  });

  it("coalesces text after unwrapping a remark-only URL", () => {
    const html = renderMarkdown("#&HTTP://example.com/");

    expect(html).toContain('<span class="tag" data-tag="&amp;HTTP">#&amp;HTTP</span>://example.com/');
    expect(html).not.toContain('data-tag="&amp;"');
  });

  it("recovers positionless text around remark-only email links", () => {
    const html = renderMarkdown("\\+foo@example.com #ok *\\+foo@example.com #inside*");
    const fallbackHTML = renderMarkdownWithoutMath("$\\+foo@example.com #math$ #outside");

    expect(html).toContain('data-tag="ok"');
    expect(html).toContain('data-tag="inside"');
    expect(fallbackHTML).not.toContain('data-tag="math"');
    expect(fallbackHTML).toContain('data-tag="outside"');
  });

  it("maps decoded positionless siblings without stealing a later source match", () => {
    const html = renderMarkdown("&#35;same \\+foo@example.com #same #left&amp; \\+bar@example.com #right");

    expect(html).toContain('#same <a href="mailto:+foo@example.com">+foo@example.com</a> <span class="tag" data-tag="same">#same</span>');
    expect(html).toContain('data-tag="left"');
    expect(html).toContain('data-tag="right"');
    expect(html.match(/data-tag="same"/g)).toHaveLength(1);
  });

  it.each([
    "*\\+foo@example.com #ok*",
    "# \\+foo@example.com #ok",
    "~~\\+foo@example.com #ok~~",
    "| value |\n| - |\n| \\+foo@example.com #ok |",
  ])("recovers positionless text inside a transparent Markdown container: %s", (source) => {
    expect(renderMarkdown(source)).toContain('data-tag="ok"');
  });

  it("keeps complete entity and escape ranges as source boundaries", () => {
    const html = renderMarkdown("https://localhost/#w&#35; HTTP://example.com/#q\\+ HTTP://example.com/#r&amp;x");

    expect(html).toContain('data-tag="w"');
    expect(html).not.toContain('data-tag="w&amp;"');
    expect(html).not.toContain('data-tag="35"');
    expect(html).toContain('data-tag="q"');
    expect(html).not.toContain('data-tag="q+"');
    expect(html).toContain('data-tag="r"');
    expect(html).not.toContain('data-tag="r&amp;"');
    expect(html).not.toContain("\\+");
    expect(html).not.toContain("&amp;amp;");
  });
  it("supplements decoded boundaries hidden by broad parser nodes", () => {
    const rejectedURL = renderMarkdown("+http://x.m/#u&#35;#v +http://x.m/#w\\|");
    expect(rejectedURL).toContain('data-tag="u"');
    expect(rejectedURL).toContain('data-tag="v"');
    expect(rejectedURL).toContain('data-tag="w"');
    expect(rejectedURL).not.toContain('data-tag="35"');

    const longEntity = renderMarkdown("#a&CounterClockwiseContourIntegral;b#c");
    expect(longEntity).toContain('data-tag="a"');
    expect(longEntity).toContain('data-tag="c"');
  });
  it.each(["~#a!&&amp;)*", ":#b[&-&amp;)", "&\\;#-"])("does not widen decoded source boundaries: %s", (source) => {
    expect(renderMarkdown(source)).toContain("data-tag=");
  });
  it("keeps tags after parser-omitted trailing whitespace", () => {
    expect(renderMarkdown("before  \n#tag")).toContain('data-tag="tag"');
    expect(renderMarkdown(";.$;\nab-  )> \n#&")).toContain('data-tag="&amp;"');
  });
  it("does not resolve a link through a rejected reference definition", () => {
    const html = renderMarkdown("[#use][bad]\n\n[bad]:(");
    expect(html).toContain('data-tag="use"');
    expect(html).not.toContain("<a ");
  });
  it("keeps GFM autolinks inside a rejected reference definition opaque", () => {
    expect(renderMarkdown("[#foo@example.com]:(")).not.toContain('data-tag="foo"');
    expect(renderMarkdown("[ https://example.com/#hidden]:(")).not.toContain('data-tag="hidden"');
  });
  it.each([
    ".https://a.b/`#code` #tail",
    ".https://a.b/[#link](/x) #tail",
    ".https://a.b/![#image](/x) #tail",
    ".https://a.b/$#math$ #tail",
  ])("reparses opaque syntax swallowed by a rejected URL node: %s", (source) => {
    const html = renderMarkdown(source);
    expect(html).not.toContain('data-tag="code"');
    expect(html).not.toContain('data-tag="link"');
    expect(html).not.toContain('data-tag="image"');
    expect(html).not.toContain('data-tag="math"');
    expect(html).toContain('data-tag="tail"');
  });
  it("projects emphasis closed inside a rejected URL node", () => {
    const html = renderMarkdown("_[http://x.m/#v_>");
    expect(html).toContain('data-tag="v"');
    expect(html).not.toContain('data-tag="v_"');
  });

  it("follows written-GFM domain and email boundaries", () => {
    const html = renderMarkdown(
      "https://example.COM/#hidden www.example.123/#also-hidden https://a_b.foo.example/路径#still-hidden " +
        "https://foo_bar.example/#visible foo#mail@example.com <foo#angle@example.com> foo@example.com/#after",
    );

    expect(html).not.toContain('data-tag="hidden"');
    expect(html).not.toContain('data-tag="also-hidden"');
    expect(html).not.toContain('data-tag="still-hidden"');
    expect(html).not.toContain('data-tag="angle"');
    expect(html).toContain('data-tag="visible"');
    expect(html).not.toContain('data-tag="mail"');
    expect(html).toContain('foo#<a href="mailto:mail@example.com">mail@example.com</a>');
    expect(html).toContain('data-tag="after"');
  });

  it("keeps written GFM URLs with Unicode domains opaque", () => {
    const html = renderMarkdown(
      "https://點看.com/#hidden www.點看.com/#also-hidden https://a_b.點看.com/#still-hidden " +
        "https://foo_bar.點看/#visible https://點看.com_/#suffix hellohttps://點看.com/#joined",
    );

    expect(html).toContain('href="https://%E9%BB%9E%E7%9C%8B.com/#hidden"');
    expect(html).toContain('href="http://www.%E9%BB%9E%E7%9C%8B.com/#also-hidden"');
    expect(html).not.toContain('data-tag="hidden"');
    expect(html).not.toContain('data-tag="also-hidden"');
    expect(html).not.toContain('data-tag="still-hidden"');
    expect(html).toContain('data-tag="visible"');
    expect(html).toContain('data-tag="suffix"');
    expect(html).toContain('data-tag="joined"');
  });

  it("uses GFM protocol and www boundaries for Unicode-domain URLs", () => {
    const html = renderMarkdown(
      "1https://點看.com/#digit .https://點看.com/#punctuation ]www.點看.com/#www " +
        "中https://點看.com/#unicode hellohttps://點看.com/#joined",
    );

    expect(html).toContain('data-tag="digit"');
    expect(html).toContain('data-tag="punctuation"');
    expect(html).toContain('data-tag="www"');
    expect(html).toContain('data-tag="unicode"');
    expect(html).toContain('data-tag="joined"');
  });

  it("keeps URLs blocked by unbalanced brackets tag-eligible", () => {
    const html = renderMarkdown(
      "[https://點看.com/#protocol\n\n[www.點看.com/#www\n\n\\[https://點看.com/#escaped\n\n\\[www.點看.com/#escaped-www",
    );

    expect(html).toContain('data-tag="protocol"');
    expect(html).toContain('data-tag="www"');
    expect(html).toContain('data-tag="escaped"');
    expect(html).toContain('data-tag="escaped-www"');
  });

  it("keeps a URL later in unresolved bracket text opaque", () => {
    const html = renderMarkdown("[text https://點看.com/#inside\n\n[more https://example.com/#ascii");

    expect(html).not.toContain('data-tag="inside"');
    expect(html).not.toContain('data-tag="ascii"');
  });

  it.each([
    "[ https://example.com/#hidden]",
    "[x https://example.com/#hidden]",
    "![ https://example.com/#hidden]",
  ])("follows GFM URL boundaries inside unresolved bracket text: %s", (source) =>
    expect(renderMarkdown(source)).not.toContain('data-tag="hidden"'));

  it("uses one explicit separator class for written URLs", () => {
    const html = renderMarkdown(
      "https://點看.com/\u00a0#nbsp https://點看.com/\u2003#em-space https://點看.com/\u000b#vertical-tab " +
        "https://點看.com/\u2028#line-separator https://點看.com/\u2029#paragraph-separator https://點看.com/\u0085#nel-hidden",
    );

    expect(html).toContain('data-tag="nbsp"');
    expect(html).toContain('data-tag="em-space"');
    expect(html).toContain('data-tag="vertical-tab"');
    expect(html).toContain('data-tag="line-separator"');
    expect(html).toContain('data-tag="paragraph-separator"');
    expect(html).not.toContain('data-tag="nel-hidden"');
  });

  it.each([
    "`[` https://example.com/#hidden",
    "$[$ https://example.com/#hidden",
    '<span data-x="[">x</span> https://example.com/#hidden',
    "<https://x.example/[> https://example.com/#hidden",
  ])("ignores brackets in earlier opaque syntax when classifying a URL: %s", (source) => {
    expect(renderMarkdown(source)).not.toContain('data-tag="hidden"');
  });

  it.each([
    [
      "#foo/bar_baz@example.com",
      "foo",
      "foo/bar_baz",
      '<span class="tag" data-tag="foo">#foo</span>/<a href="mailto:bar_baz@example.com">bar_baz@example.com</a>',
    ],
    [
      "#next/item_@example.com",
      "next",
      "next/item_",
      '<span class="tag" data-tag="next">#next</span>/<a href="mailto:item_@example.com">item_@example.com</a>',
    ],
    [
      "_foo@example.com #tag_",
      "tag",
      "tag_",
      '<em><a href="mailto:foo@example.com">foo@example.com</a> <span class="tag" data-tag="tag">#tag</span></em>',
    ],
  ])("uses the complete GFM email and emphasis source ranges: %s", (source, tag, excludedTag, rendered) => {
    const html = renderMarkdown(source);

    expect(html).toContain(`data-tag="${tag}"`);
    expect(html).not.toContain(`data-tag="${excludedTag}"`);
    expect(html).toContain(rendered);
  });

  it("keeps only canonical GFM emails opaque before the mention transform", () => {
    const html = renderMarkdown("#foo/bar_baz@example.com @alice\n\n#next/item_@example.com @bob\n\n_foo@example.com #tag_ @carol");

    expect(html).not.toContain('data-mention="example"');
    expect(html).toContain('data-mention="alice"');
    expect(html).toContain('data-mention="bob"');
    expect(html).toContain('data-mention="carol"');
    expect(html).toContain('<em><a href="mailto:foo@example.com">foo@example.com</a> <span class="tag" data-tag="tag">#tag</span></em>');
  });

  it("renders only complete writable usernames and preserves their case", () => {
    const maximum = `A${"b".repeat(35)}`;
    const html = renderMarkdown(`@Alice-2 @1alice @123 @-alice @alice- @alice_smith @${maximum} @${maximum}c`);

    expect(html).toContain('data-mention="Alice-2"');
    expect(html).toContain('data-mention="1alice"');
    expect(html).toContain(`data-mention="${maximum}"`);
    expect(html).toContain('data-mention="123"');
    expect(html).not.toContain('data-mention="-alice"');
    expect(html).not.toContain('data-mention="alice-"');
    expect(html).toContain('data-mention="alice"');
    expect(html).not.toContain(`data-mention="${maximum}c"`);
  });

  it("uses Markdown structure for mention eligibility", () => {
    const html = renderMarkdown("**@Alice** `@code` [@link](/x) https://example.com/@url $@math$ \\@escaped &#64;entity @ok");

    expect(html).toContain('data-mention="Alice"');
    expect(html).toContain('data-mention="ok"');
    expect(html.match(/data-mention=/g)).toHaveLength(2);
  });

  it.each([
    [
      "__foo@example.com #tag__ @carol",
      '<strong><a href="mailto:foo@example.com">foo@example.com</a> <span class="tag" data-tag="tag">#tag</span></strong>',
    ],
    [
      "___foo@example.com #tag___ @carol",
      '<em><strong><a href="mailto:foo@example.com">foo@example.com</a> <span class="tag" data-tag="tag">#tag</span></strong></em>',
    ],
    [
      "____foo@example.com #tag____ @carol",
      '<strong><strong><a href="mailto:foo@example.com">foo@example.com</a> <span class="tag" data-tag="tag">#tag</span></strong></strong>',
    ],
  ])("reconciles nested underscore formatting around GFM emails: %s", (source, expected) => {
    const html = renderMarkdown(source);

    expect(html).toContain(expected);
    expect(html).toContain('data-mention="carol"');
  });

  it("decodes escapes while reconciling repeated and adjacent GFM email ranges", () => {
    const escaped = renderMarkdown("#foo\\+bar@example.com #next\\_item@example.com @alice");
    const repeated = renderMarkdown("foo@bar.com@baz.example");
    const adjacent = renderMarkdown("foo@bar.com+abc@def.com");
    const invalidSuffix = renderMarkdown("#foo/bar@example.com_");

    expect(escaped).toContain('#<a href="mailto:foo+bar@example.com">foo+bar@example.com</a>');
    expect(escaped).toContain('#<a href="mailto:next_item@example.com">next_item@example.com</a>');
    expect(escaped).not.toContain('data-tag="foo"');
    expect(escaped).not.toContain('data-tag="next"');
    expect(escaped).not.toContain('data-mention="example"');
    expect(escaped).toContain('data-mention="alice"');
    expect(repeated).toContain('<a href="mailto:foo@bar.com">foo@bar.com</a>@baz.example');
    expect(repeated.match(/href="mailto:/g)).toHaveLength(1);
    expect(adjacent).toContain('<a href="mailto:foo@bar.com">foo@bar.com</a><a href="mailto:+abc@def.com">+abc@def.com</a>');
    expect(adjacent.match(/href="mailto:/g)).toHaveLength(2);
    expect(invalidSuffix).toContain('data-tag="foo/bar"');
  });

  it.each([
    ["#foo&#46;bar@example.com", "foo.bar@example.com"],
    ["#foo&period;bar@example.com", "foo.bar@example.com"],
    ["#foo&#64;example.com", "foo@example.com"],
  ])("decodes known entities before reconciling a GFM email: %s", (source, address) => {
    const html = renderMarkdown(source);

    expect(html).not.toContain('data-tag="foo"');
    expect(html).toContain(`href="mailto:${address}"`);
  });

  it("uses only contiguous literal source across mention node boundaries", () => {
    const html = renderMarkdown("#next/item_@example.com@alice");
    const spacedHTML = renderMarkdown("#next/item_@example.com @alice");
    const linkedHTML = renderMarkdown("[mail](https://example.com)@alice");
    const strongHTML = renderMarkdown("**bold**@alice");
    const emphasisHTML = renderMarkdown("*x*@alice");
    const tagHTML = renderMarkdown("#tag@alice");
    const adjacentMentionsHTML = renderMarkdown("@alice@bob");

    expect(html).not.toContain('data-mention="alice"');
    expect(spacedHTML).toContain('data-mention="alice"');
    expect(linkedHTML).toContain('data-mention="alice"');
    expect(strongHTML).toContain('data-mention="alice"');
    expect(emphasisHTML).toContain('data-mention="alice"');
    expect(tagHTML).not.toContain('data-mention="alice"');
    expect(adjacentMentionsHTML).toContain('data-mention="alice"');
    expect(adjacentMentionsHTML).not.toContain('data-mention="bob"');
  });

  it("does not turn link text or reference link fragments into tags", () => {
    const html = renderMarkdown(
      [
        "[release #notes](https://example.com/releases#release-notes)",
        "[**section #heading**](https://example.com/docs#section-heading)",
        "![preview #image](https://example.com/image#preview)",
        "[reference #anchor][docs]",
        "",
        "[docs]: https://example.com/docs#reference-anchor",
        "",
        "Outside #memo-tag",
      ].join("\n"),
    );

    expect(html).not.toContain('data-tag="notes"');
    expect(html).not.toContain('data-tag="heading"');
    expect(html).not.toContain('data-tag="image"');
    expect(html).not.toContain('data-tag="anchor"');
    expect(html).not.toContain('data-tag="release-notes"');
    expect(html).not.toContain('data-tag="section-heading"');
    expect(html).not.toContain('data-tag="preview"');
    expect(html).not.toContain('data-tag="reference-anchor"');
    expect(html).toContain('data-tag="memo-tag"');
  });

  it.each([
    "[a [#link](x) b][missing]",
    "[a ![#image](x) b][missing]",
  ])("keeps a resolved child opaque inside an unresolved outer link: %s", (source) =>
    expect(renderMarkdown(source)).not.toMatch(/data-tag="(?:link|image)"/));

  it("treats unresolved link-like syntax as ordinary tag-eligible text", () => {
    const html = renderMarkdown("[#tag][missing] [#other](unterminated");

    expect(html).toContain('data-tag="tag"');
    expect(html).toContain('data-tag="other"');
  });

  it.each([
    "[#foo@example.com][missing]",
    "[x][#foo@example.com]",
    "[#foo@example.com](unterminated",
    "![#foo@example.com][missing]",
    "[x][_#foo@example.com_]",
    "![x][_#foo@example.com_]",
  ])("keeps GFM emails opaque inside unresolved link-like source: %s", (source) => {
    const html = renderMarkdown(source);

    expect(html).not.toContain('data-tag="foo"');
    expect(html).toContain('href="mailto:foo@example.com"');
  });

  it("keeps code opaque while reparsing an unresolved second label", () => {
    const html = renderMarkdown("[x][`#foo@example.com`]");

    expect(html).not.toContain('data-tag="foo"');
    expect(html).not.toContain('href="mailto:foo@example.com"');
  });

  it.each([
    "[x][https://example.com/#foo]",
    "![x][https://example.com/#foo]",
  ])("does not give a second-label URL a synthetic boundary: %s", (source) => expect(renderMarkdown(source)).toContain('data-tag="foo"'));

  it.each(["\n", "\r", "\r\n"])("deduplicates a %j boundary projected from an unresolved second label", (lineEnding) => {
    const html = renderMarkdown(`[#a][${lineEnding}]${lineEnding}${lineEnding}[#a]: /x`);

    expect(html).toContain('data-tag="a"');
  });

  it.each([
    "[x][<#foo@example.com>]",
    "![x][<#foo@example.com>]",
    "[x][<https://example.com/#foo>]",
    "![x][<https://example.com/#foo>]",
  ])("keeps autolinks opaque while reparsing an unresolved second label: %s", (source) =>
    expect(renderMarkdown(source)).not.toContain('data-tag="foo"'));

  it.each([
    "[x][\\#escaped #real]",
    "![x][\\#escaped #real]",
    "[x][&#35;escaped #real]",
    "![x][&#35;escaped #real]",
  ])("projects escaped introducer boundaries from an unresolved second label: %s", (source) => {
    const html = renderMarkdown(source);

    expect(html).not.toContain('data-tag="escaped"');
    expect(html).toContain('data-tag="real"');
  });

  it.each(["[x][#R&amp;D #real]", "![x][#R&amp;D #real]"])("projects entity boundaries from an unresolved second label: %s", (source) => {
    const html = renderMarkdown(source);

    expect(html).toContain('data-tag="R"');
    expect(html).toContain('data-tag="real"');
    expect(html).not.toContain('data-tag="R&D"');
  });

  it("recognizes tags in unresolved second labels while preserving emphasis boundaries", () => {
    const html = renderMarkdown("[x][#two] [#one][#two] [x][**#two**] [#x][#_foo_]");

    expect(html.match(/data-tag="two"/g)).toHaveLength(3);
    expect(html).toContain('data-tag="one"');
    expect(html).toContain('data-tag="x"');
    expect(html).not.toContain('data-tag="_foo_"');
  });

  it("uses CommonMark identifier normalization for reference links", () => {
    const sharpS = renderMarkdown("[#hidden][ẞ]\n\n[SS]: /path");
    const nul = renderMarkdown("[#hidden][a\0b]\n\n[a�b]: /path");
    const nonbreakingSpace = renderMarkdown("[#visible][\u00a0ref]\n\n[ref]: /path");

    expect(sharpS).not.toContain('data-tag="hidden"');
    expect(nul).not.toContain('data-tag="hidden"');
    expect(nonbreakingSpace).toContain('data-tag="visible"');
  });

  it("continues to turn formatted text outside links into tags", () => {
    const html = renderMarkdown("**#urgent** and _#later_ but not #_split_");

    expect(html).toContain('data-tag="urgent"');
    expect(html).toContain('data-tag="later"');
    expect(html).not.toContain('data-tag="_split_"');
  });

  it("does not turn a backslash-escaped \\#tag into a tag, but still tags an unescaped one", () => {
    const html = renderMarkdown("\\#NAS is my server and a #real tag");

    // Escaped: rendered as the literal text "#NAS", never a tag pill.
    expect(html).not.toContain('data-tag="NAS"');
    expect(html).toContain("#NAS");
    // Unescaped neighbour is unaffected.
    expect(html).toContain('data-tag="real"');
  });

  it("escapes only the marked hash when escaped and unescaped tags share a node", () => {
    const html = renderMarkdown("\\#first then #second");

    expect(html).not.toContain('data-tag="first"');
    expect(html).toContain("#first");
    expect(html).toContain('data-tag="second"');
  });

  it("tags a whole word containing combining marks", () => {
    // Malayalam കവിത = ka, va, vowel-sign-i (U+0D3F, a spacing combining mark),
    // ta. The vowel sign is a \p{M} character, so the tag must not stop at കവ.
    const html = renderMarkdown("#കവിത");

    expect(html).toContain('data-tag="കവിത"');
    expect(html).not.toContain('data-tag="കവ"');
  });

  it("still tags a hash that shares a text node with an entity reference", () => {
    const html = renderMarkdown("Tom &amp; Jerry #cartoon");

    expect(html).toContain('data-tag="cartoon"');
    expect(html).toContain("Tom &amp; Jerry");
  });

  it("uses original-source syntax boundaries rather than decoded text", () => {
    const html = renderMarkdown("&#35;tag &num;tag #foo\\+bar #R&amp;D #R&D #R&bogus;D #Q&amp;&bogus;D #ok");

    expect(html).not.toContain('data-tag="tag"');
    expect(html).toContain('data-tag="foo"');
    expect(html).toContain('data-tag="R"');
    expect(html).toContain('data-tag="R&amp;D"');
    expect(html).toContain('data-tag="R&amp;bogus"');
    expect(html).toContain('data-tag="Q"');
    expect(html).toContain('data-tag="ok"');
  });

  it("renders source spelling while exposing the emitted tag value", () => {
    const html = renderMarkdown("#A‍B #́foo #foo/́bar #👩‍💻");

    expect(html).toContain('<span class="tag" data-tag="AB">#A‍B</span>');
    expect(html).toContain('<span class="tag" data-tag="foo">#́foo</span>');
    expect(html).toContain('<span class="tag" data-tag="foo/bar">#foo/́bar</span>');
    expect(html).toContain('data-tag="👩‍💻"');
  });

  it("keeps word-internal apostrophes without absorbing quotation punctuation", () => {
    const html = renderMarkdown("#tag's #сім'я #O’Brien '#quoted' #users'");

    expect(html).toContain('<span class="tag" data-tag="tag&#x27;s">#tag&#x27;s</span>');
    expect(html).toContain('<span class="tag" data-tag="сім&#x27;я">#сім&#x27;я</span>');
    expect(html).toContain('<span class="tag" data-tag="O’Brien">#O’Brien</span>');
    expect(html).toContain('&#x27;<span class="tag" data-tag="quoted">#quoted</span>&#x27;');
    expect(html).toContain('<span class="tag" data-tag="users">#users</span>&#x27;');
  });

  it("uses maximal-prefix hierarchy and adjacent-introducer rules", () => {
    const html = renderMarkdown("#book/ #book//fiction #first#second ##tag #️⃣ ##️⃣");

    expect(html.match(/data-tag="book"/g)).toHaveLength(2);
    expect(html).toContain('data-tag="first"');
    expect(html).toContain('data-tag="second"');
    expect(html).toContain('data-tag="tag"');
    expect(html.match(/data-tag="#️⃣"/g)).toHaveLength(1);
  });

  it("maps tag source on both sides of CRLF line endings", () => {
    const html = renderMarkdown("#one\r\n#two");

    expect(html).toContain('data-tag="one"');
    expect(html).toContain('data-tag="two"');
  });

  it.each([1, 2, 3])("maps paragraph continuation indentation of %d spaces", (indent) => {
    const spaces = " ".repeat(indent);
    const after = renderMarkdown(`#before\n${spaces}text`);
    const before = renderMarkdown(`text\n${spaces}#after`);

    expect(after).toContain('data-tag="before"');
    expect(before).toContain('data-tag="after"');
  });

  it.each([
    ["- #before\n  text", "before"],
    ["- text\n  #after", "after"],
    ["1. #before\n   text", "before"],
    ["1. text\n   #after", "after"],
    ["> #before\n> text", "before"],
    ["> text\n> #after", "after"],
    ["#before\n\t#after", "before"],
    ["#before\n\t#after", "after"],
    ["- > #before\n  > #after", "before"],
    ["- > #before\n  > #after", "after"],
    ["> - #before\n>   #after", "before"],
    ["> - #before\n>   #after", "after"],
  ])("maps parser-consumed continuation prefixes in %s", (source, tag) => {
    expect(renderMarkdown(source)).toContain(`data-tag="${tag}"`);
  });

  it("maps CommonMark NUL replacement without losing adjacent tags", () => {
    const html = renderMarkdown("\uFEFF#bom \0#left #right\0");

    expect(html).toContain('<span class="tag" data-tag="bom">#bom</span>');
    expect(html).not.toContain('data-tag="bo"');
    expect(html).toContain('data-tag="left"');
    expect(html).toContain('data-tag="right"');
  });

  it("keeps URL context aligned after a leading BOM", () => {
    const html = renderMarkdown("\uFEFFhttp://example.com#hidden #shown");

    expect(html).not.toContain('data-tag="hidden"');
    expect(html).toContain('data-tag="shown"');
  });

  it("treats a second leading BOM as ordinary text", () => {
    const html = renderMarkdown("\uFEFF\uFEFFhttp://example.com#shown");

    expect(html).toContain('data-tag="shown"');
  });

  it("does not treat a mid-document BOM as a written URL boundary", () => {
    const html = renderMarkdown("before\n\n\uFEFFhttp://example.com#shown");

    expect(html).toContain('data-tag="shown"');
  });

  it("keeps source positions before hard-break and mention transforms", () => {
    const html = renderMarkdown("first #one\nsecond #two\n#tag@alice #tag @bob");

    expect(html).toContain('data-tag="one"');
    expect(html).toContain('data-tag="two"');
    expect(html).not.toContain('data-mention="alice"');
    expect(html).toContain('data-mention="bob"');
  });

  it("does not tag opaque Markdown contexts", () => {
    const html = renderMarkdown("`#code` and $#math$ and <https://example.com/#link> and #ok");

    expect(html).not.toContain('data-tag="code"');
    expect(html).not.toContain('data-tag="math"');
    expect(html).not.toContain('data-tag="link"');
    expect(html).toContain('data-tag="ok"');
  });

  it("keeps tags between currency dollars visible", () => {
    const html = renderMarkdown("$20,000 #budget and $30,000");

    expect(html).toContain('data-tag="budget"');
    expect(html).not.toContain("math-inline");
  });

  it("keeps math opaque while the math renderer is loading", () => {
    const html = renderMarkdownWithoutMath("$#inline$ and $$#mismatch$ plus #ok\n\n$$\n#block\n$$");

    expect(html).not.toContain('data-tag="inline"');
    expect(html).toContain('data-tag="mismatch"');
    expect(html).not.toContain('data-tag="block"');
    expect(html).toContain('data-tag="ok"');
  });

  it("maps CRLF flow math while the math renderer is loading", () => {
    const html = renderMarkdownWithoutMath("$$\r\n#inside\r\n$$\r\n#outside");

    expect(html).not.toContain('data-tag="inside"');
    expect(html).toContain('data-tag="outside"');
  });

  it.each([
    ["$#inner\\$#outer", "$#inner$"],
    ["$#inner&amp;$#outer", "$#inner&amp;$"],
  ])("maps decoded math source before an outside tag: %s", (source, renderedPrefix) => {
    const html = renderMarkdownWithoutMath(source);

    expect(html).toContain(`${renderedPrefix}<span class="tag" data-tag="outer">#outer</span>`);
    expect(html).not.toContain('data-tag="inner"');
  });

  it("maps CommonMark NUL replacement inside fallback math", () => {
    const html = renderMarkdownWithoutMath("$#inside\0$#outside");

    expect(html).not.toContain('data-tag="inside"');
    expect(html).toContain('data-tag="outside"');
  });

  it("keeps undeclared footnote definitions opaque", () => {
    const html = renderMarkdown("A[^1]\n\n[^1]: #foot\n\n#ok");

    expect(html).not.toContain('data-tag="foot"');
    expect(html).toContain('data-tag="ok"');
  });

  it("follows flow-math metadata boundaries", () => {
    expect(renderMarkdown("$$meta\n#math")).not.toContain('data-tag="math"');
    expect(renderMarkdown("$$meta$x\n#tag")).toContain('data-tag="tag"');
  });
});
