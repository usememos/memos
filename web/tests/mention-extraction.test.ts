import { describe, expect, it } from "vitest";
import { extractMentionUsernames } from "@/lib/memo-markdown";

describe("extractMentionUsernames", () => {
  it("uses the same Markdown contexts and exact spelling as rendering", () => {
    expect(
      extractMentionUsernames("**@Alice** ~~@bob~~ `@code` [@link](/x) ![@image](/x) https://example.com/@url $@math$ @Alice"),
    ).toEqual(["Alice", "bob"]);
  });

  it("keeps escapes and GFM emails opaque", () => {
    expect(extractMentionUsernames("\\@escaped @alice@example.com @ok")).toEqual(["ok"]);
  });

  it("keeps case-distinct username references distinct", () => {
    expect(extractMentionUsernames("@Alice @alice @Alice")).toEqual(["Alice", "alice"]);
  });
});
