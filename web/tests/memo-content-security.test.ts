import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { isTrustedIframeSrc } from "@/lib/html-sanitize-schema";
import { memoResolveUrl } from "@/lib/memo-markdown";
import { renderSanitizedHtml } from "@/lib/sanitized-html";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const renderHtml = (source: string): string => {
  const element = document.createElement("div");
  renderSanitizedHtml(source, element);
  return element.innerHTML;
};

describe("raw HTML sanitization", () => {
  it("strips user-controlled inline styles from raw HTML spans", () => {
    const html = renderHtml('<span style="position:fixed;inset:0;z-index:99999">overlay</span>');
    expect(html).toContain("overlay");
    expect(html).not.toMatch(/style=/);
    expect(html).not.toMatch(/position:fixed/);
  });

  it("strips scripts and event handlers", () => {
    const html = renderHtml(
      '<div onclick="alert(1)">a<script>alert(2)</script><img src="https://img.example/a.png" onerror="alert(3)"></div>',
    );
    expect(html).not.toMatch(/onclick|onerror|<script|alert/);
    expect(html).toContain("https://img.example/a.png");
  });

  it("keeps tel: and sms: link targets and strips script-capable ones", () => {
    const html = renderHtml('<p><a href="tel:+440000000000">phone</a> <a href="sms:+44">text</a> <a href="javascript:alert(1)">x</a></p>');
    expect(html).toContain('href="tel:+440000000000"');
    expect(html).toContain('href="sms:+44"');
    expect(html).not.toMatch(/javascript:/);
  });

  it("opens links in a new tab without leaking the opener", () => {
    expect(renderHtml('<p><a href="https://example.com">x</a></p>')).toMatch(/target="_blank" rel="noopener noreferrer"/);
  });

  it("drops picture sources that would bypass the https-only image rule", () => {
    const html = renderHtml('<picture><source srcset="http://tracker.example/a.png"><img src="https://img.example/a.png"></picture>');
    expect(html).not.toMatch(/<picture|<source|tracker\.example/);
    expect(html).toMatch(/img\.example\/a\.png/);
  });

  it("drops untrusted iframe embeds", () => {
    expect(renderHtml('<iframe src="https://www.youtube.com/embed/abc123" title="demo"></iframe>')).toMatch(
      /<iframe[^>]+youtube\.com\/embed\/abc123/,
    );
    expect(renderHtml('<iframe src="https://evil.example/embed/abc123" title="demo"></iframe>')).not.toMatch(/<iframe/);
  });

  it("renders Markdown between disclosure tags and keeps the authored open state", () => {
    const html = renderHtml("<details open>\n<summary>More <b>info</b></summary>\n\nSome **bold** text\n\n</details>");
    expect(html).toMatch(/<details[^>]* open=""/);
    expect(html).toMatch(/<summary[^>]*>More <b>info<\/b><\/summary>/);
    expect(html).toContain("<strong>bold</strong>");
  });
});

describe("trusted iframe providers", () => {
  it("accepts trusted providers only", () => {
    expect(isTrustedIframeSrc("https://www.youtube.com/embed/abc123")).toBe(true);
    expect(isTrustedIframeSrc("https://www.youtube-nocookie.com/embed/abc123?si=test")).toBe(true);
    expect(isTrustedIframeSrc("https://player.vimeo.com/video/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://open.spotify.com/embed/track/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.loom.com/embed/123456")).toBe(true);
    expect(isTrustedIframeSrc("https://www.google.com/maps/embed?pb=test")).toBe(true);
    expect(isTrustedIframeSrc("https://app.diagrams.net/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://www.draw.io/?embed=1")).toBe(true);
    expect(isTrustedIframeSrc("https://evil.example/embed/abc123")).toBe(false);
  });
});

describe("image URL policy", () => {
  const resolve = memoResolveUrl([create(AttachmentSchema, { name: "attachments/photo", filename: "photo.png", type: "image/png" })]);

  it("loads images the memo names from relative or https URLs only", () => {
    expect(resolve("/assets/a.png", "image")).toBe("/assets/a.png");
    expect(resolve("https://img.example/a.png", "image")).toBe("https://img.example/a.png");
    expect(resolve("http://tracker.example/a.png", "image")).toBeNull();
    expect(resolve("javascript:alert(1)", "image")).toBeNull();
  });

  it("resolves a managed attachment image to the instance's own URL, even over plain http", () => {
    expect(window.location.protocol).toBe("http:");
    expect(resolve("/file/attachments/photo", "image")).toBe(`${window.location.origin}/file/attachments/photo/photo.png`);
  });
});
