import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { isTrustedIframeSrc } from "@/lib/html-sanitize-schema";
import { memoResolveUrl } from "@/lib/memo-markdown";
import { sanitizeMemoHtml } from "@/lib/sanitized-html";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

// As the editor hands raw HTML to `sanitizeHtml`: parsed by the browser into a fragment that is not in the page.
const renderHtml = (source: string): string => {
  const template = document.createElement("template");
  template.innerHTML = source;
  const element = document.createElement("div");
  element.append(sanitizeMemoHtml(template.content));
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

  it("upgrades scheme-relative and uppercase-scheme sources to https", () => {
    const youtube = /<iframe[^>]+src="https:\/\/www\.youtube\.com\/embed\/abc123"/;
    expect(renderHtml('<iframe src="//www.youtube.com/embed/abc123"></iframe>')).toMatch(youtube);
    expect(renderHtml('<iframe src=" HTTPS://www.youtube.com/embed/abc123"></iframe>')).toMatch(youtube);
    expect(renderHtml('<img src="HTTPS://img.example/a.png">')).toContain('src="https://img.example/a.png"');
    expect(renderHtml('<img src="//img.example/a.png">')).toContain('src="https://img.example/a.png"');
    expect(renderHtml('<iframe src="http://www.youtube.com/embed/abc123"></iframe>')).not.toMatch(/<iframe/);
    expect(renderHtml('<iframe src="//evil.example/embed/abc123"></iframe>')).not.toMatch(/<iframe/);
  });

  it("renders Bilibili's share snippet as a non-autoplaying, full-width player", () => {
    const html = renderHtml(
      '<iframe src="//player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>',
    );
    expect(html).toMatch(
      /<iframe[^>]+src="https:\/\/player\.bilibili\.com\/player\.html\?isOutside=true&amp;bvid=BV1xx411c7mD&amp;p=1&amp;autoplay=0"/,
    );
    expect(html).toMatch(/class="[^"]*w-full[^"]*aspect-video/);
    expect(renderHtml('<iframe src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=1"></iframe>')).toMatch(
      /autoplay=1"/,
    );
    expect(
      renderHtml('<iframe src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD" width="640" height="360"></iframe>'),
    ).not.toMatch(/aspect-video/);
    expect(renderHtml('<iframe src="//player.bilibili.com.evil.example/player.html?bvid=BV1xx411c7mD"></iframe>')).not.toMatch(/<iframe/);
    expect(renderHtml('<iframe src="http://player.bilibili.com/player.html?bvid=BV1xx411c7mD"></iframe>')).not.toMatch(/<iframe/);
  });

  it("keeps the disclosure's open state and the editor's markers for the Markdown between the tags", () => {
    const html = renderHtml("<details open>\n<summary>More <b>info</b></summary>\n\uE000\n</details>");
    expect(html).toMatch(/<details[^>]* open=""/);
    expect(html).toMatch(/<summary[^>]*>More <b>info<\/b><\/summary>/);
    expect(html).toContain("\uE000");
  });

  it("keeps the text of removed elements but never a script's", () => {
    const html = renderHtml("<marquee>\uE001 moving</marquee><script>alert(1)</script><style>p{}</style>");
    expect(html).toBe("\uE001 moving");
  });

  it("keeps only the allowed class names and the span data the tag and mention classes use", () => {
    expect(renderHtml('<span class="tag evil" data-tag="work" aria-label="tag">#work</span>')).toBe(
      '<span class="tag" data-tag="work" aria-label="tag">#work</span>',
    );
    expect(renderHtml('<div class="fixed inset-0" data-x="1" aria-hidden="true">a</div>')).toBe("<div>a</div>");
    expect(renderHtml('<code class="language-ts math-inline">x</code>')).toBe('<code class="language-ts math-inline">x</code>');
  });

  it("keeps heading and footnote ids as written", () => {
    expect(renderHtml('<h2 id="setup">Setup</h2><a href="#fn-1" id="ref-1">1</a>')).toMatch(/id="setup".*href="#fn-1" id="ref-1"/);
  });

  it("makes checkboxes read-only checkboxes", () => {
    expect(renderHtml('<input type="text" checked value="x">')).toMatch(/<input[^>]* type="checkbox"[^>]* disabled=""/);
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
    expect(isTrustedIframeSrc("https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1")).toBe(true);
    expect(isTrustedIframeSrc("//player.bilibili.com/player.html?bvid=BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("HTTPS://player.bilibili.com/player.html?bvid=BV1xx411c7mD")).toBe(true);
    expect(isTrustedIframeSrc("https://player.bilibili.com.evil.example/player.html?bvid=BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("https://player.bilibili.com/video/BV1xx411c7mD")).toBe(false);
    expect(isTrustedIframeSrc("http://player.bilibili.com/player.html?bvid=BV1xx411c7mD")).toBe(false);
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
