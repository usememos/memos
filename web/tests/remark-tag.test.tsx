import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";

const renderMarkdown = (content: string): string =>
  renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkTag]}>
      {content}
    </ReactMarkdown>,
  );

describe("remarkTag", () => {
  it("does not turn URL fragments inside autolinks into tags", () => {
    const html = renderMarkdown("https://github.com/dmtrKovalenko/fff#pi-agent-extension\n\nProject #memo-tag");

    expect(html).toContain('href="https://github.com/dmtrKovalenko/fff#pi-agent-extension"');
    expect(html).not.toContain('data-tag="pi-agent-extension"');
    expect(html).toContain('data-tag="memo-tag"');
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

  it("continues to turn formatted text outside links into tags", () => {
    const html = renderMarkdown("**#urgent** and _#later_");

    expect(html).toContain('data-tag="urgent"');
    expect(html).toContain('data-tag="later"');
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
    // The source slice ("...&amp;...") differs from the decoded value, so the
    // escape-aware path bows out and the tag is detected the original way.
    const html = renderMarkdown("Tom &amp; Jerry #cartoon");

    expect(html).toContain('data-tag="cartoon"');
    expect(html).toContain("Tom &amp; Jerry");
  });
});
