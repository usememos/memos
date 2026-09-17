import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { memoUrlTransform } from "@/components/MemoContent/constants";
import { getSingleLinkHref } from "@/components/MemoContent/markdown/Paragraph";

const collectSingleLinkHrefs = (content: string): Array<string | undefined> => {
  const hrefs: Array<string | undefined> = [];

  renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // Match production so handoff schemes reach the helper instead of being stripped upstream.
      urlTransform={memoUrlTransform}
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
    expect(
      collectSingleLinkHrefs("<tel:+440000000000>\n\n<sms:+440000000000>\n\n<mailto:me@example.com>\n\n<https://example.com>"),
    ).toEqual([undefined, undefined, undefined, "https://example.com"]);
  });
});
