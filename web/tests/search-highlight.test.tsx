import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Pluggable } from "unified";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { rehypeSearchHighlight } from "@/utils/rehype-plugins/rehype-search-highlight";
import { rehypeSearchSnippet, shouldUseSearchSnippet } from "@/utils/rehype-plugins/rehype-search-snippet";

interface RenderOptions {
  keywords: string[];
  caseSensitive?: boolean;
  useGfm?: boolean;
  useRawHtml?: boolean;
  useSnippet?: boolean;
  maxBlocks?: number;
}

const renderWithSearch = (content: string, options: RenderOptions): string => {
  const { keywords, caseSensitive = false, useGfm = false, useRawHtml = false, useSnippet = false, maxBlocks = 6 } = options;

  const remarkPlugins: Pluggable[] = [];
  const rehypePlugins: Pluggable[] = [];

  if (useGfm) {
    remarkPlugins.push(remarkGfm);
  }

  if (useRawHtml) {
    rehypePlugins.push(rehypeRaw);
  }

  if (useSnippet) {
    rehypePlugins.push([rehypeSearchSnippet, { keywords, caseSensitive, maxBlocks, contextBlocks: 1 }]);
  }

  rehypePlugins.push([rehypeSearchHighlight, { keywords, caseSensitive }]);

  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {content}
    </ReactMarkdown>,
  );
};

describe("rehypeSearchHighlight", () => {
  describe("basic highlighting", () => {
    it("highlights a single keyword in plain text", () => {
      const html = renderWithSearch("This is a test message", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight" data-search-match="test">test</mark>');
    });

    it("highlights multiple occurrences of the same keyword", () => {
      const html = renderWithSearch("test and test again", { keywords: ["test"] });

      const matches = html.match(/<mark[^>]*>test<\/mark>/g) ?? [];
      expect(matches).toHaveLength(2);
    });

    it("highlights multiple different keywords", () => {
      const html = renderWithSearch("hello world and test", { keywords: ["hello", "test"] });

      expect(html).toContain('<mark class="search-highlight" data-search-match="hello">hello</mark>');
      expect(html).toContain('<mark class="search-highlight" data-search-match="test">test</mark>');
    });
  });

  describe("case sensitivity", () => {
    it("matches case-insensitively by default", () => {
      const html = renderWithSearch("Hello HELLO hello", { keywords: ["hello"] });

      const matches = html.match(/<mark[^>]*>/g) ?? [];
      expect(matches).toHaveLength(3);
    });

    it("matches case-sensitively when enabled", () => {
      const html = renderWithSearch("Hello HELLO hello", { keywords: ["Hello"], caseSensitive: true });

      const matches = html.match(/<mark[^>]*>/g) ?? [];
      expect(matches).toHaveLength(1);
      expect(html).toContain('data-search-match="Hello"');
    });
  });

  describe("exclusions", () => {
    it("does not highlight code blocks", () => {
      const content = "```\ntest\n```";
      const html = renderWithSearch(content, { keywords: ["test"], useGfm: true });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("<code>");
    });

    it("does not highlight inline code", () => {
      const content = "This is `test` code";
      const html = renderWithSearch(content, { keywords: ["test"] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("<code>test</code>");
    });

    it("does not highlight tag spans", () => {
      const content = '<span class="tag">test</span> normal text';
      const html = renderWithSearch(content, { keywords: ["test"], useRawHtml: true });

      const markMatches = html.match(/<mark[^>]*>/g) ?? [];
      expect(markMatches).toHaveLength(0);
    });

    it("does not highlight mention spans", () => {
      const content = '<span class="mention">@test</span> normal text';
      const html = renderWithSearch(content, { keywords: ["test"], useRawHtml: true });

      const markMatches = html.match(/<mark[^>]*>/g) ?? [];
      expect(markMatches).toHaveLength(0);
    });
  });

  describe("markdown elements", () => {
    it("highlights text in headings", () => {
      const html = renderWithSearch("# Heading with test", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<h1>");
    });

    it("highlights text in paragraphs", () => {
      const html = renderWithSearch("This paragraph has a test keyword", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<p>");
    });

    it("highlights text in lists", () => {
      const html = renderWithSearch("- list item with test\n- another item", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<li>");
    });

    it("highlights text in blockquotes", () => {
      const html = renderWithSearch("> This is a test quote", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<blockquote>");
    });

    it("highlights link text but preserves link structure", () => {
      const html = renderWithSearch("[test link](https://example.com)", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain('<a href="https://example.com">');
      expect(html).toContain("</a>");
    });

    it("highlights text in table cells", () => {
      const content = `| Header 1 | Header 2 |
| --- | --- |
| test | cell 2 |`;
      const html = renderWithSearch(content, { keywords: ["test"], useGfm: true });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<table>");
    });
  });

  describe("edge cases", () => {
    it("handles empty keyword list gracefully", () => {
      const html = renderWithSearch("test content", { keywords: [] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("test content");
    });

    it("handles keywords with special regex characters", () => {
      const html = renderWithSearch("test.com and test[0]", { keywords: ["test.com", "test[0]"] });

      expect(html).toContain('data-search-match="test.com"');
      expect(html).toContain('data-search-match="test[0]"');
    });

    it("handles overlapping keywords (longer first)", () => {
      const html = renderWithSearch("testing", { keywords: ["test", "testing"] });

      expect(html).toContain('data-search-match="testing"');
    });

    it("does not modify text with no matches", () => {
      const html = renderWithSearch("normal content without matches", { keywords: ["nonexistent"] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("normal content without matches");
    });
  });
});

describe("rehypeSearchSnippet", () => {
  const createLongContent = (middleMatchText: string): string => {
    const introParagraphs = [
      "This is the first paragraph that serves as an introduction to the topic at hand.",
      "The second paragraph continues with some background information and context.",
      "A third paragraph provides additional details that help set the scene.",
      "The fourth paragraph transitions into the main content area.",
      "This paragraph contains a significant lead-up to the important information.",
    ];

    const matchParagraph = `This is the important paragraph that contains the ${middleMatchText} keyword we are searching for. It has additional context around the match.`;

    const outroParagraphs = [
      "Following the important section, there is more related content here.",
      "This paragraph discusses additional aspects of the topic.",
      "The penultimate paragraph wraps up some loose ends.",
      "Finally, the last paragraph concludes the entire discussion.",
    ];

    return [...introParagraphs, matchParagraph, ...outroParagraphs].join("\n\n");
  };

  describe("basic snippet selection", () => {
    it("does not modify content when block count is below threshold", () => {
      const content = "Paragraph one.\n\nParagraph two with test.\n\nParagraph three.";
      const html = renderWithSearch(content, { keywords: ["test"], useSnippet: true, maxBlocks: 10 });

      expect(html).toContain("Paragraph one");
      expect(html).toContain("Paragraph two");
      expect(html).toContain("Paragraph three");
      expect(html).not.toContain("search-ellipsis");
    });

    it("selects snippet with match when content is long", () => {
      const content = createLongContent("target");
      const html = renderWithSearch(content, { keywords: ["target"], useSnippet: true, maxBlocks: 3 });

      expect(html).toContain('<mark class="search-highlight" data-search-match="target">target</mark>');
      expect(html).toContain("search-ellipsis");
    });

    it("includes ellipsis before snippet when match is not at beginning", () => {
      const content = createLongContent("middle");
      const html = renderWithSearch(content, { keywords: ["middle"], useSnippet: true, maxBlocks: 3 });

      const ellipsisCount = (html.match(/search-ellipsis/g) ?? []).length;
      expect(ellipsisCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("multi-keyword selection", () => {
    it("selects window with most keyword matches", () => {
      const paragraphs = [
        "First paragraph with keyword1.",
        "Second paragraph.",
        "Third paragraph with keyword1 and keyword2.",
        "Fourth paragraph with keyword2.",
        "Fifth paragraph.",
        "Sixth paragraph with keyword1.",
      ];

      const content = paragraphs.join("\n\n");
      const html = renderWithSearch(content, { keywords: ["keyword1", "keyword2"], useSnippet: true, maxBlocks: 2 });

      expect(html).toContain("Third paragraph");
      expect(html).toContain("Fourth paragraph");
    });

    it("highlights all matching keywords in selected snippet", () => {
      const content =
        "First paragraph.\n\nSecond paragraph with keyword1 and keyword2.\n\nThird paragraph with keyword2.\n\nFourth paragraph.";
      const html = renderWithSearch(content, { keywords: ["keyword1", "keyword2"], useSnippet: true, maxBlocks: 2 });

      const markCount = (html.match(/<mark[^>]*>/g) ?? []).length;
      expect(markCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("exclusions in snippet", () => {
    it("does not count matches in code blocks for snippet selection", () => {
      const content = `First paragraph.

Second paragraph.

\`\`\`
code with keyword
\`\`\`

Third paragraph with actual keyword.

Fourth paragraph.`;

      const html = renderWithSearch(content, { keywords: ["keyword"], useSnippet: true, maxBlocks: 2, useGfm: true });

      expect(html).toContain("Third paragraph");
    });

    it("does not count matches in tag spans for snippet selection", () => {
      const content = `<span class="tag">keyword</span> in first paragraph.

Second paragraph.

Third paragraph with the real keyword match.`;

      const html = renderWithSearch(content, { keywords: ["keyword"], useSnippet: true, maxBlocks: 2, useRawHtml: true });

      expect(html).toContain("Third paragraph");
    });
  });

  describe("context preservation", () => {
    it("preserves markdown structure in selected snippet", () => {
      const content = `Intro paragraph.

- List item 1
- List item 2 with keyword
- List item 3

Another paragraph.`;

      const html = renderWithSearch(content, { keywords: ["keyword"], useSnippet: true, maxBlocks: 3 });

      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
      expect(html).toContain("List item 2");
    });

    it("preserves link structure in selected snippet", () => {
      const content = `First paragraph.

Second paragraph with a [link](https://example.com) that contains keyword.

Third paragraph.`;

      const html = renderWithSearch(content, { keywords: ["keyword"], useSnippet: true, maxBlocks: 2 });

      expect(html).toContain('<a href="https://example.com">');
      expect(html).toContain('<mark class="search-highlight"');
    });
  });
});

describe("shouldUseSearchSnippet", () => {
  it("returns false when no keywords provided", () => {
    const result = shouldUseSearchSnippet({
      content: "This is a very long content that exceeds the threshold characters easily.",
      keywords: [],
      thresholdChars: 100,
    });

    expect(result).toBe(false);
  });

  it("returns false when content is shorter than threshold", () => {
    const result = shouldUseSearchSnippet({
      content: "Short content",
      keywords: ["test"],
      thresholdChars: 500,
    });

    expect(result).toBe(false);
  });

  it("returns false when first match is near beginning", () => {
    const content = "test" + "a".repeat(600);
    const result = shouldUseSearchSnippet({
      content,
      keywords: ["test"],
      thresholdChars: 500,
    });

    expect(result).toBe(false);
  });

  it("returns true when first match is far from beginning", () => {
    const content = "a".repeat(300) + " target " + "b".repeat(300);
    const result = shouldUseSearchSnippet({
      content,
      keywords: ["target"],
      thresholdChars: 500,
    });

    expect(result).toBe(true);
  });

  it("returns false when no match found", () => {
    const result = shouldUseSearchSnippet({
      content: "a".repeat(600),
      keywords: ["nonexistent"],
      thresholdChars: 500,
    });

    expect(result).toBe(false);
  });

  it("uses default threshold when not specified", () => {
    const shortContent = "short";
    const result1 = shouldUseSearchSnippet({
      content: shortContent,
      keywords: ["short"],
    });

    expect(result1).toBe(false);
  });
});
