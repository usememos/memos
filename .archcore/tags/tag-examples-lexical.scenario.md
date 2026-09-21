---
title: "Tag lexical recognition examples"
status: draft
tags:
  - "tags"
---

## Subject
Status: Accepted (2026-08-01).

Lexical tag recognition in memo Markdown: how an author's `#` source becomes a tag identifier and which source stays prose. Illustrates clauses 1–24 and failure rules 1–6 of the tag lexical grammar spec. The Go lexer, the web lexer, and everyone who relies on tag values depend on these cases.

## Actors
| Actor | Who they are | What they want |
|---|---|---|
| Memo author | a person writing memo Markdown | Not recorded in the source. |

## Flows
### Memo author
Anchors: @markdown/parser/tag.go, @web/src/utils/tag-grammar.ts, @markdown/parser/tag_test.go, @web/tests/tag-grammar.test.ts
1. Memo author writes `#work/notes` in a paragraph; Memos extracts the identifier `work/notes`.
2. Memo author writes `hello#tag` without a space; Memos extracts `tag`.
3. Memo author writes `#foo,bar`; Memos extracts `foo` and leaves `,bar` as prose.
4. Memo author writes `#first#second`; Memos extracts `first` and `second`.

Extensions: 1a. Memo author writes `#'tag`; Memos extracts no tag and leaves `'tag` as prose.
1b. Memo author writes `#/book`; Memos extracts no tag, because a hierarchy cannot begin with an empty segment.

## Examples
Background: the memo author writes each source as plain paragraph text, outside any code, link, HTML, or math context.

### Writing a tag in a plain paragraph
Illustrates: clauses 1–24; failure rules 1–6.
Given the memo author wrote <source> as a paragraph.
When Memos scans the paragraph for tags.
Then Memos extracts <identifiers> and leaves <remaining> as prose.

A `—` in `remaining` means the case names no remaining source; `empty` means the whole source was consumed.

| source | identifiers | remaining | notes |
|---|---|---|---|
| `#tag` | `tag` | — | Basic identifier |
| `hello#tag` | `tag` | — | No general left boundary |
| `中文#tag` | `tag` | — | No general left boundary |
| `#标签` | `标签` | — | Multilingual XID characters |
| `#2026` | `2026` | — | Numeric-only identifiers are valid |
| `#C++` | `C++` | empty | Explicit `+` extension |
| `#R&D` | `R&D` | empty | Explicit `&` extension |
| `#tag's` | `tag's` | empty | ASCII apostrophe joins two XID code points |
| `#сім'я` | `сім'я` | empty | ASCII apostrophe preserves a Ukrainian word |
| `#O’Brien` | `O’Brien` | empty | Right single quotation mark joins two XID code points |
| `#café's` | `café's` | empty | An emitted combining mark may precede an apostrophe joiner |
| `#users'` | `users` | `'` | A trailing apostrophe is not a joiner |
| `#foo'1️⃣` | `foo` | `'1️⃣` | Emoji-first tokenization prevents an apostrophe from adjoining the keycap sequence |
| `#'tag` | none | `'tag` | An apostrophe cannot start a segment |
| `'#tag'` | `tag` | — | Surrounding quotation punctuation remains outside the occurrence |
| `#rock’n’roll` | `rock’n’roll` | — | Multiple apostrophe joiners are valid when each independently satisfies the context rule |
| `#OʼBrien` | `OʼBrien` | — | U+02BC is an ordinary `XID_Continue` code point |
| `#` followed by 101 `a` code points | all 101 `a` code points | — | There is no tag-specific length limit |
| `#-foo` | `-foo` | empty | Visible connector extensions may begin a segment |
| `#foo-` | `foo-` | empty | Visible connector extensions may end a segment |
| `#---` | `---` | empty | A segment may contain only visible connector extensions |
| `#&&` | `&&` | empty | Visible connector extensions may repeat |
| `#A‍B` | `AB` | empty | A non-emoji ZWJ is consumed but omitted from the value |
| `#‍foo` | `foo` | empty | An ignored leading ZWJ does not prevent a later value unit from starting the segment |
| `#A‌B` | `AB` | empty | A non-emoji ZWNJ is consumed but omitted from the value |
| `#‌foo` | `foo` | empty | An ignored leading ZWNJ does not prevent a later value unit from starting the segment |
| `#‍‌` | none | — | Ignored default-ignorable code points alone do not form a segment |
| `#A️B` | `AB` | empty | A default-ignorable variation selector outside a matched fully-qualified emoji is omitted even after a starter |
| `#́foo` | `foo` | empty | A non-default-ignorable combining mark before the segment starter is consumed but omitted |
| `#́` | none | U+0301 COMBINING ACUTE ACCENT | Leading combining marks alone do not form a segment |
| `#café` | `café` | empty | A non-default-ignorable combining mark after the segment starter is preserved |
| `#work/notes` | `work/notes` | empty | Direct hierarchical identifier; memo membership also includes `work` |
| `#foo/́bar` | `foo/bar` | empty | Ignored leading combining-mark handling restarts for each segment |
| `#book/` | `book` | `/` | A trailing slash is not consumed |
| `#/book` | none | `/book` | A hierarchy cannot begin with an empty segment |
| `#book//fiction` | `book` | `//fiction` | A repeated slash terminates before the first slash |
| `#book/fiction/` | `book/fiction` | `/` | The valid hierarchical prefix is retained |
| `#l·l` | `l·l` | — | Middle dot is `XID_Continue` |
| `#foo‿bar` | `foo‿bar` | — | Connector punctuation is `XID_Continue` |
| `#*️⃣` | `*️⃣` | — | Fully-qualified keycap sequence |
| `#‼️` | `‼️` | — | Fully-qualified emoji sequence |
| `#♥` | none | — | Bare text-presentation symbol is neither XID nor fully-qualified emoji |
| `#♥️` | `♥️` | — | Fully-qualified emoji sequence |
| `#🏻` | none | — | A standalone emoji component is excluded from `FullyQualifiedEmoji` |
| `#foo,` | `foo` | — | Comma terminates the identifier |
| `#foo,bar` | `foo` | `,bar` | Punctuation ends the maximal prefix |
| `#foo.bar` | `foo` | `.bar` | Punctuation ends the maximal prefix |
| `#foo:bar` | `foo` | `:bar` | Punctuation ends the maximal prefix |
| `#x=y` | `x` | `=y` | Punctuation ends the maximal prefix |
| `#price€` | `price` | `€` | Currency symbol terminates the identifier |
| `#€budget` | none | — | The first body character is not a unit |
| `#v²` | `v` | — | `Other_Number` is not generally `XID_Continue` |
| `#first#second` | `first`, `second` | — | Ordinary `#` terminates and starts candidates |
| `##tag` | `tag` | — | Introduced by the second `#` |
| `## tag` | none | — | An ATX heading marker followed by text |
| `#️⃣` | none | — | The complete source is a fully-qualified emoji, not an introducer plus identifier |
| `##️⃣` | `#️⃣` | — | The first `#` introduces the atomic keycap emoji value |
| `#first#️⃣` | `first#️⃣` | — | The keycap emoji is an ordinary fully-qualified continuation unit |
| `＃tag` | none | — | Fullwidth number sign is not an introducer |
| `﹟tag` | none | — | Small number sign is not an introducer |
| `#R&D` | `R&D` | empty | A literal ampersand is a value unit |

## Open Questions
- None recorded.
