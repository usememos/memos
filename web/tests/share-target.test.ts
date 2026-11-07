import { describe, expect, it } from "vitest";
import { initialEditorState } from "@/components/MemoEditor/edit/initialState";
import { cacheService } from "@/components/MemoEditor/edit/services/cacheService";
import { sharedDataFromSearch, sharedDataToMarkdown } from "@/lib/share-target";

describe("sharedDataToMarkdown", () => {
  it("puts title, text and URL on their own paragraphs", () => {
    expect(sharedDataToMarkdown({ title: "Article", text: "A quote", url: "https://example.com/a" })).toBe(
      "Article\n\nA quote\n\nhttps://example.com/a",
    );
  });

  it("drops fields the text already contains", () => {
    expect(sharedDataToMarkdown({ title: "Article", text: "Article https://example.com/a", url: "https://example.com/a" })).toBe(
      "Article https://example.com/a",
    );
  });

  it("ignores missing and blank fields", () => {
    expect(sharedDataToMarkdown({ title: " ", text: null, url: "https://example.com/a" })).toBe("https://example.com/a");
    expect(sharedDataToMarkdown({})).toBe("");
  });

  it("reads the share target's query string", () => {
    expect(sharedDataFromSearch("?title=Hello%20world&text=Body&url=https%3A%2F%2Fexample.com")).toEqual({
      title: "Hello world",
      text: "Body",
      url: "https://example.com",
    });
  });
});

describe("initialEditorState seed content", () => {
  const draftKey = cacheService.key("users/share", "new:global");

  it("appends the seed to the restored draft as its own paragraph", () => {
    cacheService.saveNow(draftKey, { content: "Earlier thought\n", attachments: [] });
    expect(initialEditorState({ draftKey, seedContent: "https://example.com" }).content).toBe("Earlier thought\n\nhttps://example.com");
    cacheService.clear(draftKey);
  });

  it("starts an empty draft with the seed alone", () => {
    expect(initialEditorState({ draftKey, seedContent: "https://example.com" }).content).toBe("https://example.com");
  });
});
