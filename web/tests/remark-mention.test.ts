import { describe, expect, it } from "vitest";
import { extractMentionUsernames } from "@/utils/mention-extraction";
import { findMentionMatches } from "@/utils/mention-grammar";
import { MAX_USERNAME_LENGTH } from "@/utils/username";

describe("findMentionMatches", () => {
  it("recognizes complete writable usernames without changing case", () => {
    expect(findMentionMatches("@alice @Alice-2 @1alice @a--b @123 @123-456").map((match) => match.username)).toEqual([
      "alice",
      "Alice-2",
      "1alice",
      "a--b",
      "123",
      "123-456",
    ]);
  });

  it("accepts 36 characters and rejects the complete 37-character run", () => {
    const maximum = `a${"b".repeat(MAX_USERNAME_LENGTH - 1)}`;
    expect(findMentionMatches(`@${maximum}`).map((match) => match.username)).toEqual([maximum]);
    expect(findMentionMatches(`@${maximum}c`)).toEqual([]);
  });

  it.each(["@-alice", "@alice-", "@álîçé"])('rejects the invalid username shape "%s"', (source) => {
    expect(findMentionMatches(source)).toEqual([]);
  });

  it("uses username characters as the source boundary", () => {
    expect(findMentionMatches("hello@alice foo-@bob foo_@carol 中文@dave (@erin)").map((match) => match.username)).toEqual([
      "carol",
      "dave",
      "erin",
    ]);
    expect(findMentionMatches("@alice", false)).toEqual([]);
  });

  it("treats other characters as ordinary right boundaries", () => {
    expect(findMentionMatches("@alice_smith @bob@carol").map((match) => match.username)).toEqual(["alice", "bob"]);
  });
});

describe("extractMentionUsernames", () => {
  it("uses the same Markdown contexts and exact spelling as rendering", () => {
    expect(
      extractMentionUsernames("**@Alice** ~~@bob~~ `@code` [@link](/x) ![@image](/x) https://example.com/@url $@math$ @Alice"),
    ).toEqual(["Alice", "bob"]);
  });

  it("keeps escapes, character references, and GFM emails opaque", () => {
    expect(extractMentionUsernames("\\@escaped &#64;entity @alice@example.com foo@bar.com@bob @ok")).toEqual(["ok"]);
  });

  it("keeps case-distinct username references distinct", () => {
    expect(extractMentionUsernames("@Alice @alice @Alice")).toEqual(["Alice", "alice"]);
  });
});
