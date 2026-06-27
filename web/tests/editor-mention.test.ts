import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/Editor/markdownCodec";

function firstParagraphChildren(markdown: string) {
  return parseMarkdown(markdown).content?.[0]?.content ?? [];
}

function hasMentionMark(node: JSONContent) {
  return (node.marks ?? []).some((m) => m.type === "mention");
}

describe("Mention mark", () => {
  it("parses @username into mention-marked text", () => {
    const mentioned = firstParagraphChildren("hey @alice there").find(hasMentionMark);
    expect(mentioned).toMatchObject({ type: "text", text: "@alice", marks: [{ type: "mention", attrs: { username: "alice" } }] });
  });

  it("serializes mention-marked text back to @username verbatim", () => {
    expect(roundTripMarkdown("ping @bob now").trim()).toBe("ping @bob now");
  });

  it("preserves username case in the editor model (no lowercasing)", () => {
    const mentioned = firstParagraphChildren("@Alice").find(hasMentionMark);
    expect(mentioned).toMatchObject({ text: "@Alice", marks: [{ type: "mention", attrs: { username: "Alice" } }] });
    expect(roundTripMarkdown("@Alice").trim()).toBe("@Alice");
  });

  it("supports hyphenated usernames", () => {
    const username = firstParagraphChildren("@jane-doe ok")
      .find(hasMentionMark)
      ?.marks?.find((m) => m.type === "mention")?.attrs?.username;
    expect(username).toBe("jane-doe");
    expect(roundTripMarkdown("@jane-doe ok").trim()).toBe("@jane-doe ok");
  });

  it("autolinks a bare email to mailto and never treats it as a mention", () => {
    // The `@` in an email must not become a mention, and the email itself must
    // still autolink to a mailto: link (GFM, same as the read-only view) — for
    // a standalone email and one mid-sentence alike. The mention tokenizer must
    // stay out of the email's way rather than splitting the text at its `@`.
    for (const input of ["support@example.com", "mail support@example.com please"]) {
      expect(firstParagraphChildren(input).some(hasMentionMark)).toBe(false);
      expect(roundTripMarkdown(input)).toContain("[support@example.com](mailto:support@example.com)");
    }
  });

  it("stops at a mention-char boundary: @a@b is mention `a` then literal `@b`", () => {
    const mentioned = firstParagraphChildren("@a@b").filter(hasMentionMark);
    expect(mentioned).toHaveLength(1);
    expect(mentioned[0]).toMatchObject({ text: "@a", marks: [{ type: "mention", attrs: { username: "a" } }] });
    expect(roundTripMarkdown("@a@b").trim()).toBe("@a@b");
  });

  it("carries both bold and mention marks on **@bob** and round-trips", () => {
    const input = "**hi @bob**";
    expect(roundTripMarkdown(input).trim()).toBe(input);
    const markTypes = (firstParagraphChildren(input).find((n) => n.text === "@bob")?.marks ?? []).map((m) => m.type);
    expect(markTypes).toContain("bold");
    expect(markTypes).toContain("mention");
  });

  it("keeps a mention inside a link label and round-trips byte-identically", () => {
    const input = "[ping @bob](https://example.com)";
    expect(roundTripMarkdown(input).trim()).toBe(input);
  });

  it("does not create a mention from an all-hyphen run", () => {
    const children = firstParagraphChildren("@--- nope");
    expect(children.some(hasMentionMark)).toBe(false);
    expect(roundTripMarkdown("@--- nope").trim()).toBe("@--- nope");
  });

  it("caps the username at 32 chars, leaving the overflow as plain text", () => {
    const input = `@${"a".repeat(40)}`;
    const username = firstParagraphChildren(input)
      .find(hasMentionMark)
      ?.marks?.find((m) => m.type === "mention")?.attrs?.username;
    expect(username).toBe("a".repeat(32));
    expect(roundTripMarkdown(input).trim()).toBe(input);
  });

  it("marks the mentions, autolinks the email, in a mixed line", () => {
    // Mentions stay mentions (editor preserves case, unlike backend extraction
    // which lowercases), the email autolinks to mailto, and the two never
    // collide. Based on the backend's canonical case (markdown_test.go).
    const input = "Hi @Alice and @bob. Email support@example.com today.";
    const usernames = firstParagraphChildren(input)
      .filter(hasMentionMark)
      .map((n) => n.marks?.find((m) => m.type === "mention")?.attrs?.username);
    expect(usernames).toEqual(["Alice", "bob"]);

    const out = roundTripMarkdown(input).trim();
    expect(out).toBe("Hi @Alice and @bob. Email [support@example.com](mailto:support@example.com) today.");
  });
});
