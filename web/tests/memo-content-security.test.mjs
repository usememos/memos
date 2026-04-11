import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";
import { SANITIZE_SCHEMA, isTrustedIframeSrc } from "../src/components/MemoContent/constants.ts";

const TrustedIframe = (props) => {
  if (typeof props.src !== "string" || !isTrustedIframeSrc(props.src)) {
    return null;
  }

  return React.createElement("iframe", props);
};

const renderMemoContent = (content) =>
  renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
      children: content,
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], [rehypeKatex, { throwOnError: false, strict: false }]],
      components: {
        iframe: TrustedIframe,
      },
    }),
  );

test("strips user-controlled inline styles from raw HTML spans", () => {
  const html = renderMemoContent('<span style="position:fixed;inset:0;z-index:99999">overlay</span>');

  assert.match(html, /<span>overlay<\/span>/);
  assert.doesNotMatch(html, /style=/);
  assert.doesNotMatch(html, /position:fixed/);
});

test("still renders KaTeX output after sanitizing math marker classes", () => {
  const html = renderMemoContent("$L$");

  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-html"/);
});

test("allows trusted iframe providers only", () => {
  assert.equal(isTrustedIframeSrc("https://www.youtube.com/embed/abc123"), true);
  assert.equal(isTrustedIframeSrc("https://www.youtube-nocookie.com/embed/abc123?si=test"), true);
  assert.equal(isTrustedIframeSrc("https://player.vimeo.com/video/123456"), true);
  assert.equal(isTrustedIframeSrc("https://open.spotify.com/embed/track/123456"), true);
  assert.equal(isTrustedIframeSrc("https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/123456"), true);
  assert.equal(isTrustedIframeSrc("https://www.loom.com/embed/123456"), true);
  assert.equal(isTrustedIframeSrc("https://www.google.com/maps/embed?pb=test"), true);
  assert.equal(isTrustedIframeSrc("https://app.diagrams.net/?embed=1"), true);
  assert.equal(isTrustedIframeSrc("https://www.draw.io/?embed=1"), true);
  assert.equal(isTrustedIframeSrc("https://evil.example/embed/abc123"), false);
});

test("drops untrusted iframe embeds during rendering", () => {
  const trusted = renderMemoContent('<iframe src="https://www.youtube.com/embed/abc123" title="demo"></iframe>');
  const untrusted = renderMemoContent('<iframe src="https://evil.example/embed/abc123" title="demo"></iframe>');

  assert.match(trusted, /<iframe/);
  assert.match(trusted, /youtube\.com\/embed\/abc123/);
  assert.doesNotMatch(untrusted, /<iframe/);
});
