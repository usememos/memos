---
title: "Tag Markdown context examples"
status: draft
tags:
  - "tags"
---

## Subject
Status: Accepted (2026-08-01).

Markdown-context eligibility and source spans of tags in memo Markdown. Illustrates clauses 1–13 and failure rules 1–7 of the tag Markdown-context and source-span spec. The Go transformer, the render plugin, the editor decoration, and completion depend on these cases.

## Actors
| Actor | Who they are | What they want |
|---|---|---|
| Memo author | a person writing memo Markdown | Not recorded in the source. |

## Flows
### Memo author
Anchors: @markdown/extensions/tag.go, @web/src/utils/remark-plugins/remark-tag.ts, @web/src/components/MemoEditor/Editor/markdownTagRanges.ts, @web/tests/remark-tag.test.tsx
1. Memo author writes `**#urgent**`; Memos shows `urgent` as a tag inside the bold text.
2. Memo author writes `/path#tag` as plain text; Memos extracts `tag`.
3. Memo author writes `[hello#tag](https://example.com)`; Memos shows a link and extracts no tag.
4. Memo author writes `` `#tag` `` as inline code; Memos extracts no tag.

Extensions: 2a. Memo author writes `https://example.com/#tag`; Memos parses a URL and extracts no tag.

## Examples
Background: the memo author writes each source as one paragraph; Memos parses it as GFM 0.29-gfm with the Memos extensions.

### Writing a tag inside Markdown syntax
Illustrates: clauses 1–9; failure rules 1–7.
Given the memo author wrote <source> in a paragraph.
When Memos parses the paragraph and scans eligible text.
Then Memos extracts <identifiers> and leaves <remaining> as other Markdown.

A `—` in `remaining` means the case names no remaining source.

| source | identifiers | remaining | notes |
|---|---|---|---|
| `&#35;tag` | none | — | A character reference is not a literal introducer |
| `&num;tag` | none | — | Decoded text is not rescanned for candidates |
| `\#tag` | none | — | Escaped introducer |
| `#foo\+bar` | `foo` | `\+bar` | A Markdown escape terminates the literal-source range |
| `#R&amp;D` | `R` | `&amp;D` | A character reference terminates the literal-source range |
| `` `#tag` `` | none | — | Inline-code context |
| `**#urgent**` | `urgent` | — | Formatted normal text remains eligible |
| `https://example.com/#tag` | none | — | GFM URL/autolink context |
| `/path#tag` | `tag` | — | Plain text path is not guessed to be a URL |
| `[hello#tag](https://example.com)` | none | — | The complete link is excluded |
| `$#tag$` | none | — | A Memos math node is opaque |
| `` #foo`test` `` | `foo` | `` `test` `` | The inline-code span begins immediately after the identifier |
| `[release #notes](https://example.com/releases#notes)` | none | — | Neither the link label nor the destination produces a tag |
| `https://example.com/path#tag` | none | — | Parsed as a URL or autolink |

### Checking the span of a recognized tag
Illustrates: clauses 10–13.
Given the memo author wrote <source> in a paragraph.
When Memos recognizes the tag.
Then the direct value is <value> and the recognized span holds <span>.

| source | value | span | notes |
|---|---|---|---|
| `##tag` | `tag` | the second `#tag` | The first `#` stays prose |
| `#A‍B` | `AB` | `#`, `A`, U+200D ZWJ, `B` | The value is the two-code-point string `AB` |
| `#́foo` | `foo` | includes the leading U+0301 COMBINING ACUTE ACCENT | The leading mark is consumed but omitted |
| `#café` | `café` | — | U+0301 follows the segment starter and stays in the value |

## Open Questions
- None recorded.
