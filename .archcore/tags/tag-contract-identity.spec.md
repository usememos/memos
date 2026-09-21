---
title: "Tag identity and hierarchy"
status: draft
tags:
  - "tags"
---

## Purpose & Scope
Status: Accepted (2026-08-01).

This spec defines what a recognized tag is in the Memos domain: source ownership, identity and equality, and hierarchy expansion into the memo tag set. It is normative for payload extraction, the API `Memo.tags` field, tag counts, filters, navigation, tag metadata matching, and import and export. Out of scope: the identifier grammar, Markdown-context eligibility, existing-data migration, rollout, backfill, and metadata remapping.

## Surface
- Memo tag set: `appendTagHierarchy` in @markdown/markdown.go expands each direct value; the result feeds the memo payload.
- API: `Memo.tags` in @proto/api/v1/memo_service.proto (output only).
- Filter field `tags` in @filter/schema.go; web tag tree and helpers in @web/src/components/TagTree.tsx and @web/src/lib/tag.ts.
- Source edits: `RenameTag` in @markdown/markdown.go rewrites recognized source spans.
- Terms: a *tag* is a value in a memo tag set, derived from occurrences as a direct value or an implied ancestor. It has no identity apart from the source that produces it.
- Terms: an *implied ancestor* is a slash-delimited prefix of a direct value; the *comparison key* is the exact display value; the *memo tag set* is the union of direct values and ancestors.
- Terms: a *tag metadata rule* is user configuration that selects tag values and supplies presentation or behavior metadata.

## Normative Behavior
Domain ownership
1. The system MUST treat memo Markdown as the source of truth for tags.
2. The system MUST derive payload tags, API fields, counts, navigation entries, completion candidates, and metadata matches from recognized source occurrences.
3. The system MUST NOT offer an independently mutable tag resource.
4. WHEN a tag is renamed, the system MUST edit every memo source occurrence that should change.
5. A tag metadata rule MAY decorate or affect the derived values it matches.
6. A tag metadata rule MUST NOT change the source spelling or identity of a tag.
7. WHEN a metadata rule is created or changed, the system MUST NOT create or rename a tag.
8. The store MUST treat persisted payload tags as rebuildable indexes, not authoritative tag records.
9. Import and export MUST preserve memo Markdown without substituting a separate canonical tag label for the source spelling.

Identity and equality
10. The system MUST use the emitted display value, without case folding or Unicode normalization, as the comparison key.
11. The system MUST treat two identifiers as equal only when their emitted Unicode code-point sequences are identical.
12. WHEN deduplicating, counting, filtering, navigating, or performing exact metadata lookup, the system MUST NOT apply case folding.
13. WHEN performing those operations, the system MUST NOT apply canonical, compatibility, or width normalization, locale-sensitive comparison, or accent folding.
14. WHEN one memo holds several occurrences with exactly equal direct values, the system MUST record one memo-tag membership.
15. A tag metadata rule MAY deliberately match several distinct tags without changing their identity.
16. WHEN an operand is supplied to an exact filter or metadata lookup, the system MUST compare it as supplied.

Hierarchy and membership
17. WHEN a direct value is recognized, the system MUST add it and every slash-delimited ancestor prefix to the memo tag set.
18. The API MUST expose both direct values and implied ancestors in `Memo.tags`.
19. WHEN an exact membership filter names an ancestor, the filter MUST match a memo that holds only a descendant occurrence.
20. The system MUST compute a tag count as the number of memo tag sets containing that value.
21. Rendering and export MUST preserve the one source occurrence.
22. Rendering and export MUST NOT insert ancestor hashtags into Markdown.

## Constraints & Invariants
- Each exactly equal value MUST appear once in a memo tag set.
- Any difference in a value's Unicode code-point sequence MUST produce a separate membership.
- One memo MUST contribute at most one count to each direct or implied tag.
- Source spellings that differ only in ignored default-ignorable code points or ignored leading combining marks MUST compare equal.
- Every hierarchy segment MUST be non-empty.

## Failure Behavior
1. IF two display values differ in any code point, as `#Work` and `#work` do, THEN the system MUST keep them as distinct tags.
2. IF an exact lookup operand contains code points the lexer would ignore, THEN the system MUST NOT re-lex or strip them.
3. IF a memo tag set would repeat a value, THEN the system MUST keep one entry.

## Conformance
An implementation conforms when it satisfies clauses 1–22, every invariant, and every failure rule. Hierarchy and rename cases live in @markdown/markdown_test.go (`TestExtractAllExpandsTagHierarchy`, `TestRenameTagOnlyChangesRecognizedSourceSpans`) and @web/tests/tag-tree.test.ts.

Given a memo whose source holds `#book/fiction/history`.
When its tags are derived.
Then the memo tag set is `book`, `book/fiction`, `book/fiction/history`.
