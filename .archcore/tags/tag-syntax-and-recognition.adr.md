---
title: "Tag syntax and recognition"
status: draft
tags:
  - "tags"
---

## Context
Status: Accepted (2026-08-01).

Tag meaning affects rendering, payload indexes, filtering, counts, navigation, metadata, and editor completion, so divergent recognizers produce inconsistent values. The decision defines one source-derived language instead of treating existing parser behavior as normative; pinned tables live in @markdown/parser/tag_unicode_tables.go. Data migration, rollout, backfill, and metadata remapping are outside this decision.

## Decision
Derive tags from eligible original Markdown source using a Memos Unicode 17.0/Emoji 17.0 profile, exact emitted-value equality, non-empty slash hierarchy, and Markdown-structural context recognition.

## Decision Details
Memo Markdown owns tag identity; payload tags, API fields, counts, completion, navigation, and metadata matches are rebuildable projections. Renaming a tag requires editing its source occurrences; metadata rules cannot independently rename or create it.
Only literal ASCII `#` introduces a tag, except when already consumed inside a longest fully-qualified emoji sequence. There is no general left boundary, deliberately admitting `hello#tag`.
The profile admits `XID_Continue` with stated exclusions, complete fully-qualified Emoji 17.0 sequences, and visible `-`, `+`, `&` units. Numeric-only/emoji-only tags and repeated connector-only segments are valid.
Unicode and Emoji versions are pinned rather than inherited from Go/browser/Node runtime tables. Repertoire updates change language meaning and require an explicit specification change.
Default-ignorable code points outside matched emoji are consumed without emission; non-default-ignorable `Mn`/`Mc` marks are omitted only before each segment starter. After the starter, those combining marks remain part of the value.
ASCII/right-curly apostrophes join only adjacent qualifying emitted XID units after emoji-first tokenization; they do not start/end/repeat as unrestricted units. Modifier-letter apostrophe follows ordinary XID rules.
The scanner retains the longest valid prefix, uses slash only between non-empty segments, and stops before invalid/trailing/repeated separators. After a successful candidate, scanning continues at the first unconsumed position, so an ordinary terminating `#` is reconsidered as a possible next introducer; a failed introducer advances by one code point.
GFM 0.29-gfm and explicit Memos extensions identify literal source runs. Recognizers use original source, never decoded text, and do not cross escapes, character references, syntax tokens, or node boundaries.
Ordinary formatting/block text is eligible. Code, complete links/images, autolinks, raw HTML syntax/opaque blocks, math, and undeclared extension nodes are opaque; a second URL regex does not determine context.
Recognized spans retain introducers and consumed spelling; displayed values omit only the defined ignored characters. Rendering preserves source spelling, while completion replaces the consumed spelling after the introducer.
Comparison uses the exact emitted Unicode sequence without case, canonical/compatibility, width, locale, or accent folding. Exact lookup operands are already values and are not re-lexed.
A direct hierarchical value contributes itself and each ancestor once to the memo tag set; counts count memo memberships rather than occurrences. Rendering/export retain the original occurrence without inserting ancestors.
There is no tag-specific length cap; memo size supplies the enclosing bound.

## Alternatives Considered
- **Keep `L/M/N/S` and patch URL detection:** rejected because `\p{S}` admits currency, mathematical operators, modifier symbols, and Markdown backticks merely as a side effect of supporting emoji, and URL detection would still differ across consumers and duplicate the Markdown parser.
- **Require a whitespace or punctuation boundary before `#`:** rejected because it makes the intentionally supported `hello#tag` form invalid and uses a lexical approximation to solve a structural URL problem.
- **Adopt UAX31-R8 unchanged:** rejected because its recommended flowing-text left boundary does not match the product decision, and its raw emoji component repertoire is broader than the desired complete-sequence behavior. Memos instead defines an explicit UAX #31 profile.
- **Use `Extended_Pictographic | Emoji_Component` as code-point characters:** rejected because it admits bare `*`, isolated modifiers and regional indicators, invisible emoji tag characters, and unassigned code points reserved for future emoji. Matching only fully-qualified entries expresses the intended user-visible unit.
- **Keep the 100-code-point limit:** rejected because the value is arbitrary, counts code points rather than user-perceived characters, and currently has three different overflow behaviors; memo-size limits already bound work.
- **Reject an entire candidate when a later invalid character appears:** rejected because hashtags in flowing text conventionally end at punctuation; maximal-prefix behavior makes `#foo,` and `#foo` followed by inline code predictable.
- **Allow empty hierarchy segments:** rejected because empty segments have no useful navigation or membership meaning and would require special handling in hierarchy expansion.
- **Reject a whole hierarchy after an invalid slash:** rejected because keeping the longest valid prefix makes a trailing or repeated slash behave like other terminating syntax and avoids erasing an otherwise valid tag.
- **Restrict visible connectors by position:** rejected because requiring `-`, `+`, or `&` to be medial, non-repeating, or accompanied by a letter adds validation rules without resolving a structural ambiguity.
- **Treat apostrophes as unrestricted value units:** rejected because it would absorb surrounding quotation punctuation into values such as `tag'` and make quoted source such as `'#tag'` ambiguous.
- **Recognize compatibility number signs:** rejected because U+FE5F and U+FF03 are visually similar to `#` but are not Markdown syntax; recognizing only ASCII U+0023 keeps the introducer rule literal and unambiguous.
- **Special-case the number-sign keycap:** rejected because `#️⃣` follows the same longest-sequence matching rule as every other admitted fully-qualified emoji; excluding it or splitting its code points would add an exception to the emoji profile.
- **Scan decoded Markdown text:** rejected because decoding character references and escapes first would allow non-literal introducers and require source reconstruction for exact spans.
- **Leave the Markdown dialect parser-defined:** rejected because parser-dependent context would allow identical source to produce different tags.

## Consequences
### Positive
- Tag meaning is specified independently of any single parser or issue, and all consumers can implement the same language contract.
- One language describes multilingual, numeric, emoji, hierarchy, and word-internal-apostrophe tags across consumers.
- `hello#tag` works consistently while actual Markdown links and URLs are excluded structurally.
- Exact identity avoids locale-dependent folding; ignored non-emoji invisible characters do not introduce extra tag values.
- Source spans remain usable for source-preserving rendering and completion.
- Hierarchy has one membership/counting meaning without changing Markdown content.
- Unicode repertoire changes require an explicit specification update rather than depending on runtime tables.
### Tradeoffs
- Emoji recognition requires sequence-aware tables, and pinned Unicode data needs maintenance.
- Visually/canonically equivalent emitted spellings can remain distinct; apostrophe variants (U+0027, U+2019, U+02BC) are not unified.
- Possessive-looking `#tag's` denotes the complete tag value rather than tag plus prose.
- Spellings differing only in ignored default-ignorable code points, or only in ignored leading combining marks, intentionally collapse to one derived value while retaining distinct source text.

## References
- [Unicode 17.0 Standard Annex #31: Unicode Identifiers and Syntax](https://www.unicode.org/reports/tr31/tr31-43.html)
- [UAX #31 Hashtag Identifiers](https://www.unicode.org/reports/tr31/tr31-43.html#Hashtag_Identifiers)
- [UAX #31 Emoji Profile](https://www.unicode.org/reports/tr31/tr31-43.html#Emoji_Profile)
- [Unicode Emoji 17.0 (UTS #51)](https://www.unicode.org/reports/tr51/tr51-29.html)
- [Unicode Emoji 17.0 test data](https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt)
- [GitHub Flavored Markdown specification](https://github.github.com/gfm/)
- [Memos tag documentation](https://usememos.com/docs/usage/tags)
