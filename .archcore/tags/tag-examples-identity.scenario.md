---
title: "Tag identity and hierarchy examples"
status: draft
tags:
  - "tags"
---

## Subject
Status: Accepted (2026-08-01).

Tag identity, equality, and hierarchy membership in Memos. Illustrates clauses 10–22 and failure rule 1 of the tag identity and hierarchy spec. Payload extraction, `Memo.tags`, counts, filters, navigation, and metadata matching depend on these cases.

## Actors
| Actor | Who they are | What they want |
|---|---|---|
| Memo author | a person writing memo Markdown | Not recorded in the source. |

## Flows
### Memo author
Anchors: @markdown/markdown.go, @filter/schema.go, @web/src/components/TagTree.tsx, @markdown/markdown_test.go, @web/tests/tag-tree.test.ts
1. Memo author writes `#book/fiction/history` in a memo; Memos lists `book`, `book/fiction`, and `book/fiction/history`.
2. Memo author filters by `book`; Memos shows the memo, which holds only the descendant occurrence.
3. Memo author writes `#Work` in one memo and `#work` in another; Memos lists two tags.

Extensions: 1a. Memo author opens the rendered memo; Memos shows the one source occurrence and inserts no ancestor hashtags.

## Examples
Background: the memo author writes each source as plain paragraph text in their own memos.

### Expanding a hierarchical tag
Illustrates: clauses 17–22.
Given the memo author wrote `#book/fiction/history` in one memo.
When Memos derives the memo tag set.
Then the direct tag value is `book/fiction/history`.
And the memo tag set is `book`, `book/fiction`, `book/fiction/history`.
And the memo contributes one count to each of those three tags.

### Comparing spellings that look alike
Illustrates: clauses 10–13; failure rule 1.
Given the memo author wrote <first> in one memo and <second> in another.
When Memos deduplicates, counts, and filters tags.
Then Memos treats the pair as <result>.

| first | second | result |
|---|---|---|
| `#Work` | `#work` | two distinct tags |
| `#café` | `#café` | two distinct tags |
| `#Ａ` | `#A` | two distinct tags |
| `#straße` | `#STRASSE` | two distinct tags |
| `#O'Brien` | `#O’Brien` | two distinct tags |
| `#O’Brien` | `#OʼBrien` | two distinct tags |

### Writing spellings that differ only in ignored code points
Illustrates: clauses 11 and 14.
Given the memo author wrote `#AB`, `#A‍B`, and `#A‌B` in one memo.
When Memos derives the memo tag set.
Then all three emit the comparison key `AB` and the memo holds one `AB` membership.
And the Markdown source keeps all three spellings unchanged.

### Writing a tag with an ignored leading mark
Illustrates: clauses 11 and 14.
Given the memo author wrote `#foo` and `#́foo` in one memo.
When Memos derives the memo tag set.
Then both emit `foo` and the memo holds one `foo` membership.

## Open Questions
- None recorded.
