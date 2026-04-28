import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Pluggable } from "unified";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { rehypeSearchHighlight } from "@/utils/rehype-plugins/rehype-search-highlight";

interface RenderOptions {
  keywords: string[];
  caseSensitive?: boolean;
  useGfm?: boolean;
  useRawHtml?: boolean;
}

const renderWithHighlight = (content: string, options: RenderOptions): string => {
  const { keywords, caseSensitive = false, useGfm = false, useRawHtml = false } = options;

  const remarkPlugins: Pluggable[] = [];
  const rehypePlugins: Pluggable[] = [];

  if (useGfm) {
    remarkPlugins.push(remarkGfm);
  }

  if (useRawHtml) {
    rehypePlugins.push(rehypeRaw);
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
      const html = renderWithHighlight("This is a test message", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight" data-search-match="test">test</mark>');
    });

    it("highlights multiple occurrences of the same keyword", () => {
      const html = renderWithHighlight("test and test again", { keywords: ["test"] });

      const matches = html.match(/<mark[^>]*>test<\/mark>/g) ?? [];
      expect(matches).toHaveLength(2);
    });

    it("highlights multiple different keywords", () => {
      const html = renderWithHighlight("hello world and test", { keywords: ["hello", "test"] });

      expect(html).toContain('<mark class="search-highlight" data-search-match="hello">hello</mark>');
      expect(html).toContain('<mark class="search-highlight" data-search-match="test">test</mark>');
    });
  });

  describe("case sensitivity", () => {
    it("matches case-insensitively by default", () => {
      const html = renderWithHighlight("Hello HELLO hello", { keywords: ["hello"] });

      const matches = html.match(/<mark[^>]*>/g) ?? [];
      expect(matches).toHaveLength(3);
    });

    it("matches case-sensitively when enabled", () => {
      const html = renderWithHighlight("Hello HELLO hello", { keywords: ["Hello"], caseSensitive: true });

      const matches = html.match(/<mark[^>]*>/g) ?? [];
      expect(matches).toHaveLength(1);
      expect(html).toContain('data-search-match="Hello"');
    });
  });

  describe("exclusions", () => {
    it("does not highlight code blocks", () => {
      const content = "```\ntest\n```";
      const html = renderWithHighlight(content, { keywords: ["test"], useGfm: true });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("<code>");
    });

    it("does not highlight inline code", () => {
      const content = "This is `test` code";
      const html = renderWithHighlight(content, { keywords: ["test"] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("<code>test</code>");
    });

    it("does not highlight tag spans", () => {
      const content = '<span class="tag">test</span> normal text';
      const html = renderWithHighlight(content, { keywords: ["test"], useRawHtml: true });

      const markMatches = html.match(/<mark[^>]*>/g) ?? [];
      expect(markMatches).toHaveLength(0);
    });

    it("does not highlight mention spans", () => {
      const content = '<span class="mention">@test</span> normal text';
      const html = renderWithHighlight(content, { keywords: ["test"], useRawHtml: true });

      const markMatches = html.match(/<mark[^>]*>/g) ?? [];
      expect(markMatches).toHaveLength(0);
    });
  });

  describe("markdown elements", () => {
    it("highlights text in headings", () => {
      const html = renderWithHighlight("# Heading with test", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<h1>");
    });

    it("highlights text in paragraphs", () => {
      const html = renderWithHighlight("This paragraph has a test keyword", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<p>");
    });

    it("highlights text in lists", () => {
      const html = renderWithHighlight("- list item with test\n- another item", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<li>");
    });

    it("highlights text in blockquotes", () => {
      const html = renderWithHighlight("> This is a test quote", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<blockquote>");
    });

    it("highlights link text but preserves link structure", () => {
      const html = renderWithHighlight("[test link](https://example.com)", { keywords: ["test"] });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain('<a href="https://example.com">');
      expect(html).toContain("</a>");
    });

    it("highlights text in table cells", () => {
      const content = `| Header 1 | Header 2 |
| --- | --- |
| test | cell 2 |`;
      const html = renderWithHighlight(content, { keywords: ["test"], useGfm: true });

      expect(html).toContain('<mark class="search-highlight"');
      expect(html).toContain("<table>");
    });
  });

  describe("edge cases", () => {
    it("handles empty keyword list gracefully", () => {
      const html = renderWithHighlight("test content", { keywords: [] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("test content");
    });

    it("handles keywords with special regex characters", () => {
      const html = renderWithHighlight("test.com and test[0]", { keywords: ["test.com", "test[0]"] });

      expect(html).toContain('data-search-match="test.com"');
      expect(html).toContain('data-search-match="test[0]"');
    });

    it("handles overlapping keywords (longer first)", () => {
      const html = renderWithHighlight("testing", { keywords: ["test", "testing"] });

      expect(html).toContain('data-search-match="testing"');
    });

    it("does not modify text with no matches", () => {
      const html = renderWithHighlight("normal content without matches", { keywords: ["nonexistent"] });

      expect(html).not.toContain('<mark class="search-highlight"');
      expect(html).toContain("normal content without matches");
    });
  });
});
