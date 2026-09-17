import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { getSingleLinkHref } from "@/components/MemoContent/markdown/Paragraph";

const collectSingleLinkHrefs = (content: string): Array<string | undefined> => {
  const hrefs: Array<string | undefined> = [];

  renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children, node }) => {
          hrefs.push(getSingleLinkHref(node));
          return <p>{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>,
  );

  return hrefs;
};

describe("memo content paragraph links", () => {
  it("treats only bare single-link paragraphs as single link hrefs", () => {
    expect(collectSingleLinkHrefs("https://www.bilibili.com/\n\n[bilibili](https://www.bilibili.com/)")).toEqual([
      "https://www.bilibili.com/",
      undefined,
    ]);
  });

  it("does not offer previews for handoff links", () => {
    expect(collectSingleLinkHrefs("<tel:+440000000000>\n\n<mailto:me@example.com>\n\n<https://example.com>")).toEqual([
      undefined,
      undefined,
      "https://example.com",
    ]);
  });
});
