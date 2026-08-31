import { describe, expect, it } from "vitest";
import { buildBookmarkContent } from "@/pages/Bookmark";

describe("buildBookmarkContent", () => {
  it("builds a titled link with tags", () => {
    expect(buildBookmarkContent("https://example.com/a", "Example A", ["unread"])).toBe("[Example A](https://example.com/a) #unread");
  });

  it("builds a bare link without a title", () => {
    expect(buildBookmarkContent("https://example.com/a", "", [])).toBe("https://example.com/a");
  });

  it("normalizes tag hashes and drops empties", () => {
    expect(buildBookmarkContent("https://example.com/a", "T", ["#read-later", "", " unread "])).toBe(
      "[T](https://example.com/a) #read-later #unread",
    );
  });

  it("returns empty content without a url", () => {
    expect(buildBookmarkContent("", "Title", ["unread"])).toBe("");
  });
});
