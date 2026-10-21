import { describe, expect, it } from "vitest";
import { isTrustedIframeSrc } from "@/lib/html-sanitize-schema";

describe("isTrustedIframeSrc", () => {
  it("allows Bilibili's official player embed in both URL forms", () => {
    expect(isTrustedIframeSrc("https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1")).toBe(true);
    expect(isTrustedIframeSrc("//player.bilibili.com/player.html?isOutside=true&aid=170001&bvid=BV1xx411c7mD&cid=279786&p=1")).toBe(true);
  });

  it("rejects look-alike hosts, other paths, and non-HTTPS URLs", () => {
    expect(isTrustedIframeSrc("https://player.bilibili.com.evil.example/player.html?bvid=BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("//player.bilibili.com.evil.example/player.html?bvid=BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("https://evil.example/https://player.bilibili.com/player.html")).toBe(false);
    expect(isTrustedIframeSrc("https://player.bilibili.com/video/BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("https://player.bilibili.com/player.html.evil?bvid=BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("http://player.bilibili.com/player.html?bvid=BV1xx411c7mD")).toBe(false);
  });

  it("keeps the existing providers working", () => {
    expect(isTrustedIframeSrc("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(isTrustedIframeSrc("https://player.vimeo.com/video/123456789")).toBe(true);
  });
});
