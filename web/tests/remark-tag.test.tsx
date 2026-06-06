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
});
