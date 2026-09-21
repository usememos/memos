---
title: "Tag Markdown context and source spans"
status: draft
tags:
  - "tags"
---

## Purpose & Scope
Status: Accepted (2026-08-01).

This spec defines where a lexical tag candidate becomes a tag occurrence: Markdown-context eligibility over literal-source runs, and how recognized source spans are used. It is normative for the Go tag transformer, the web render plugin, the editor decoration, and editor completion, which must agree on the same occurrences and spans. Out of scope: the identifier grammar and scanning, tag identity and hierarchy, existing-data migration, rollout, backfill, and metadata remapping.

## Surface
- Go: `tagASTTransformer` in @markdown/extensions/tag.go runs after GFM has resolved syntax and passes eligible literal text to the lexer.
- Web render: @web/src/utils/remark-plugins/remark-tag.ts; Memos extensions: @web/src/utils/memo-markdown-extension.ts.
- Editor: @web/src/components/MemoEditor/Editor/markdownTagRanges.ts (used by @web/src/components/MemoEditor/Editor/tagMentionDecorations.ts) and @web/src/components/MemoEditor/Editor/tagAutocomplete.ts.
- Terms: a *literal-source run* is a contiguous range of original source exposed as literal characters with no intervening escape, character reference, syntax token, or node boundary; it keeps its enclosing context.
- Terms: *eligible text* is a run whose context GFM 0.29-gfm classifies as textual content, or a Memos extension explicitly exposes as ordinary text.
- Terms: an *opaque node* is a GFM or Memos extension node whose source is not eligible; the *recognized source span* is the introducer plus its complete source spelling.
- Terms: the *display value* is a direct or implied value as a label; it keeps emitted code points and omits ignored ones.

## Normative Behavior
Context
1. The recognizer MUST divide the original source into literal-source runs and record each run's enclosing context before lexical scanning.
2. The recognizer MUST pass each literal-source run to the lexer separately.
3. The lexer MUST read literal characters from the run's original source range, not a decoded or rendered text-node value.
4. WHEN a candidate's complete source span lies in eligible text, the recognizer MUST treat the candidate as a tag occurrence.
5. The recognizer MUST determine context from the GFM 0.29-gfm syntax tree plus declared Memos extensions.
6. The recognizer MUST NOT use a second URL regular expression to determine context.
7. The recognizer MUST treat text inside emphasis, strong emphasis, strikethrough, headings, lists, quotes, and table cells as eligible.
8. WHEN a Memos extension explicitly exposes ordinary text, the recognizer MUST treat that text as eligible.
9. WHEN the Markdown parser exposes text between inline HTML tags as an ordinary text node, the recognizer MAY find tags in it.

Extracted value and source span
10. The recognizer MUST exclude the introducer from the extracted direct tag value.
11. The recognizer MUST include the introducer and the entire consumed source spelling in the recognized source span.
12. The recognizer MUST include ignored default-ignorable code points and ignored leading combining marks in the span.
13. Highlighting and inline tag rendering MUST use the full recognized source span and preserve its source spelling.
14. The renderer MUST use the display value for derived tag labels.
15. WHEN a completion is accepted, the editor MUST replace the consumed source spelling after the introducer.
16. WHEN a completion is accepted, the editor MUST NOT replace prose before the introducer.
17. The recognizer MUST preserve the original source spelling.
18. The recognizer MUST NOT apply case folding or normalization before lexical boundaries are found.

## Constraints & Invariants
- A Markdown escape, character reference, syntax token, or node boundary MUST be a hard boundary that no candidate crosses.
- A character reference that renders as `#` MUST NOT act as an introducer.
- Syntax that renders as a valid tag unit MUST NOT join the literal source on either side.
- The whole link-like node MUST be excluded, label and destination alike.
- New Memos extension node types MUST be opaque by default.
- Memos extensions MUST stay opaque unless their definition explicitly declares them transparent to tag recognition.
- Recognizers MUST NOT scan HTML markup or opaque HTML blocks.

## Failure Behavior
1. IF Markdown escapes the introducer, as in `\#tag`, THEN the recognizer MUST NOT produce an occurrence.
2. IF the source is inside inline code, fenced code, or indented code, THEN the recognizer MUST NOT produce an occurrence.
3. IF the source is anywhere inside a link, autolink, or GFM literal URL, THEN the recognizer MUST NOT produce an occurrence.
4. IF the source is anywhere inside a link reference, image, or image alt text, THEN the recognizer MUST NOT produce an occurrence.
5. IF the source is inside raw HTML syntax or an opaque raw HTML block, THEN the recognizer MUST NOT produce an occurrence.
6. IF the source is inside an opaque Memos extension node, including inline or block math, THEN the recognizer MUST NOT produce an occurrence.
7. IF a candidate's span is not wholly in eligible text, THEN the recognizer MUST NOT produce an occurrence.

## Conformance
An implementation conforms when it satisfies clauses 1–18, every invariant, and every failure rule in the Go transformer, the render plugin, the editor decoration, and completion. Cases live in @markdown/markdown_test.go, @web/tests/remark-tag.test.tsx, and @web/tests/editor-tag-autocomplete.test.ts.

Given the source `[release #notes](https://example.com/releases#notes)`.
When the recognizer parses it.
Then neither the link label nor the destination produces a tag.

## References
- [GitHub Flavored Markdown specification](https://github.github.com/gfm/)
