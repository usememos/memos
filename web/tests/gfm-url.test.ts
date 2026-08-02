import { describe, expect, it } from "vitest";
import { writtenGFMURLSourceRange } from "@/utils/gfm-url";

describe("written GFM URL source ranges", () => {
  it.each([
    ["www.example.com/path?!", "www.example.com/path"],
    ['www.example.com/path\"', "www.example.com/path"],
    ["www.example.com/path))", "www.example.com/path"],
    ["www.example.com/path(value))", "www.example.com/path(value)"],
    ["www.example.com/path&amp;", "www.example.com/path"],
    ["www.example.com/path]", "www.example.com/path"],
    ["www.example.com/path(value)", "www.example.com/path(value)"],
  ])("trims the canonical tail in %s", (source, expected) => {
    expect(writtenGFMURLSourceRange(source, 0)).toEqual({ from: 0, to: expected.length });
  });

  it("keeps punctuation that is followed by URL content", () => {
    const source = "www.example.com/path?#tag";
    expect(writtenGFMURLSourceRange(source, 0)).toEqual({ from: 0, to: source.length });
  });
});
