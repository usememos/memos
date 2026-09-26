import { describe, expect, it } from "vitest";
import { buildMemoReferenceMarkdown, buildMemoReferenceURL, MEMO_REFERENCE_LABEL, parseMemoReferenceURL } from "@/lib/memo-reference";

describe("memo reference syntax", () => {
  it("builds an ordinary Markdown link with the default label", () => {
    expect(buildMemoReferenceURL("abc123")).toBe("/memos/abc123");
    expect(buildMemoReferenceMarkdown("abc123")).toBe("[Memos](/memos/abc123)");
    expect(buildMemoReferenceMarkdown("abc123", "my note")).toBe("[my note](/memos/abc123)");
    expect(MEMO_REFERENCE_LABEL).toBe("Memos");
  });

  it("round-trips every destination it builds", () => {
    for (const uid of ["a", "abc123", "a-b-c", "A1"]) {
      expect(parseMemoReferenceURL(buildMemoReferenceURL(uid))).toBe(uid);
    }
  });

  it("keeps a fragment, because a heading inside a memo still references it", () => {
    expect(parseMemoReferenceURL("/memos/abc123#section")).toBe("abc123");
  });

  it.each([
    ["", "an empty destination"],
    ["/memos/", "no uid"],
    ["/memos/abc/extra", "a deeper path"],
    ["/memos/abc?q=1", "a query"],
    ["/memos/ab%20c", "percent-encoding"],
    ["/memos/-abc", "a uid that cannot start with a hyphen"],
    ["memos/abc123", "a destination that is not root-relative"],
    ["https://example.com/memos/abc123", "another host's /memos/ path"],
    ["//example.com/memos/abc123", "a protocol-relative URL"],
    ["/u/alice", "an unrelated in-app path"],
    ["https://memos.example.com/m/abc123", "the legacy share path"],
  ])("treats %s as an ordinary link (%s)", (href) => {
    expect(parseMemoReferenceURL(href)).toBeUndefined();
  });

  it("rejects a uid longer than the identifier limit", () => {
    expect(parseMemoReferenceURL(`/memos/${"a".repeat(36)}`)).toBe("a".repeat(36));
    expect(parseMemoReferenceURL(`/memos/${"a".repeat(37)}`)).toBeUndefined();
  });
});
