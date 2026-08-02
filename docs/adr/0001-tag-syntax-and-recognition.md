# ADR 0001: Tag Syntax and Recognition

Status: Accepted

Date: 2026-08-01

Domain glossary: [Memos domain glossary](../glossary.md)

## Context

Tags are part of Memos' Markdown language, not merely an editor decoration. A tag occurrence affects rendered memo content, the derived tags stored in a
memo payload, API responses, tag counts, filters, tag metadata, navigation, and editor completion.

Memos currently has four related but different implementations:

- The Go Markdown parser recognizes Unicode letters, marks, numbers, and symbols, plus `ZWJ`, `_`, `-`, `/`, and `&`. It extracts at most 100 Unicode
  code points and has no general left boundary.
- The read-only remark plugin uses a similar frontend character class without `ZWJ`. It rejects a run longer than 100 code points and has special handling
  for adjacent `#` characters.
- The editor decoration uses the frontend character class but requires a non-letter/non-number before `#`, so it does not highlight `hello#tag`. It scans
  raw text without consulting the editor's Markdown syntax tree.
- Editor completion has no left boundary, no length limit, and no Markdown-context check.

These differences expose implementation drift but do not define the desired language. This ADR starts from intended product semantics; current behavior
is non-normative.

This ADR defines the current Memos tag syntax and recognition rules, covering:

- The lexical form of a tag identifier.
- How a tag candidate is found in flowing Markdown text.
- Which Markdown contexts can contain a tag occurrence.
- Pinned Unicode and emoji data.

Existing-data migration, rollout, backfill, and metadata remapping are outside this ADR's scope.

Markdown context is defined against the [GFM 0.29-gfm specification](https://github.github.com/gfm/). Memos-specific Markdown extensions layer on that
baseline and are opaque to tag recognition unless their own definition explicitly exposes ordinary text.

The slash is a hierarchy separator between non-empty segments. `-`, `+`, and `&` are unrestricted visible segment units. Tag equality is exact: the display
value itself is the comparison key, with no case folding or Unicode normalization.

A tag is a value derived from memo Markdown, not a durable entity with an identity independent of its source occurrences. Memos cannot rename a tag by
changing metadata or a separate tag record. Renaming `#Work` to `#work` across 100 memos requires editing those 100 memo sources.

## Decision drivers

- Work naturally for multilingual personal notes, including numeric tags and emoji.
- Preserve common word-internal apostrophes without absorbing surrounding quotation punctuation into tag values.
- Recognize `hello#tag` intentionally without mistaking URL fragments for tags.
- Give the backend, renderer, editor decoration, and completion the same values and source spans.
- Use Markdown syntax rather than ad hoc URL or code regular expressions.
- Avoid accepting every Unicode symbol merely to support emoji.
- Keep parsing deterministic across Go, JavaScript runtimes, and Unicode upgrades.
- Keep lexical scanning linear in memo size.

## Terminology

**Tag**
: A classification value in a memo tag set, derived from one or more tag occurrences either as a direct tag value or as an implied ancestor. A tag is not
  independently created, owned, or renamed outside the source text that produces it.

**Introducer**
: An ASCII number sign `#` (U+0023) that is not part of a matched fully-qualified emoji sequence and begins a tag candidate. It is not included in the
  extracted tag value.

**Tag identifier**
: The non-empty Unicode code-point sequence emitted from a tag source spelling, for example `work/notes` from `#work/notes`.

**Tag candidate**
: An introducer followed by a source spelling that matches the lexical grammar entirely within one literal-source run, before that run's Markdown context
  is checked for eligibility.

**Tag occurrence**
: A tag candidate whose complete recognized source span is in an eligible literal-source run.

**Literal-source run**
: A contiguous range of original Markdown source exposed by parsing as literal characters with no intervening Markdown escape, character reference, syntax
  token, or node boundary. Each run retains its enclosing Markdown context for eligibility checks.

**Eligible text**
: A literal-source run whose enclosing context is classified as textual content by GFM 0.29-gfm or explicitly exposed as ordinary text by a Memos
  Markdown extension.

**Opaque Markdown node**
: A GFM syntax node or Memos extension node whose source is not eligible for tag recognition. New extension node types are opaque by default.

**Source spelling**
: The exact source substring consumed after the introducer, including ignored default-ignorable code points and ignored leading combining marks. Inline
  rendering and source-preserving operations use this spelling.

**Recognized source span**
: The exact contiguous substring of original Markdown formed by the introducer and its complete source spelling.

**Direct tag value**
: The identifier value emitted from a tag occurrence before hierarchy expansion. It may differ from the source spelling because default-ignorable code
  points outside a matched fully-qualified emoji sequence and ignored leading combining marks before the starter of each segment are consumed but omitted.

**Implied ancestor tag**
: A slash-delimited prefix derived from a direct tag value. For example, `book` is an implied ancestor of the direct value `book/fiction`.

**Tag segment**
: A non-empty component of a hierarchical tag identifier. Slashes separate segments and are not part of any segment.

**Apostrophe joiner**
: U+0027 APOSTROPHE (`'`) or U+2019 RIGHT SINGLE QUOTATION MARK (`’`) emitted inside a tag segment only when, after emoji-first tokenization, the
  immediately preceding source code point emits as an `XID_Continue` code point and the immediately following source code point emits as a non-combining
  `XID_Continue` code point.

**Display value**
: The direct or implied value presented as a derived tag label. It preserves emitted code points exactly but does not contain ignored default-ignorable code
  points or ignored leading combining marks.

**Comparison key**
: The value used to compare two display values for tag identity. It is the exact display value without case folding or Unicode
  normalization.

**Memo tag set**
: The union of direct tag values and their implied ancestor tags exposed for a memo. Each exactly equal value appears once; any difference in the value's
  Unicode code-point sequence produces a separate membership.

**Tag metadata rule**
: User configuration that selects tag values and supplies presentation or behavior metadata. Creating or changing a metadata rule does not create or rename
  a tag.

## Decision

### Domain ownership

Memo Markdown is the source of truth for tags. Stored payload tags, API fields, counts, navigation entries, completion candidates, and metadata matches are
derived projections of recognized source occurrences.

There is no independently mutable tag resource in this domain model. In particular:

- A tag cannot be renamed without editing every memo source occurrence that should change.
- Tag metadata may decorate or affect matching derived values, but it cannot change their source spelling or identity.
- Persisted payload tags are rebuildable indexes, not authoritative tag records.
- Import and export preserve memo Markdown; they do not substitute a separate canonical tag label for the spelling in source.

### Lexical syntax

Memos tag syntax is based on Unicode UAX #31 and Unicode Emoji data, with custom rules for Memos. It is not an unchanged implementation of UAX31-R8 or
the UAX #31 Emoji Profile.

The normative grammar is:

```text
TagCandidate        := Introducer TagSourceSpelling
Introducer          := U+0023 NUMBER SIGN ("#") outside a FullyQualifiedEmoji
TagSourceSpelling   := TagSegmentSpelling ("/" TagSegmentSpelling)*
TagSegmentSpelling  := IgnoredPrefix* SegmentStarter SegmentContinuation*
IgnoredPrefix       := IgnoredDefaultIgnorable | IgnoredLeadingCombiningMark
SegmentContinuation := ValueUnit | ApostropheJoiner | IgnoredDefaultIgnorable

SegmentStarter := EmittedXIDContinueCodePointExceptCombiningMark
                | FullyQualifiedEmoji
                | "-"
                | "+"
                | "&"

ValueUnit := EmittedXIDContinueCodePoint
           | FullyQualifiedEmoji
           | "-"
           | "+"
           | "&"

ApostropheJoiner := U+0027 APOSTROPHE ("'")
                  | U+2019 RIGHT SINGLE QUOTATION MARK ("’")

IgnoredDefaultIgnorable := Default_Ignorable_Code_Point outside a FullyQualifiedEmoji
IgnoredLeadingCombiningMark := XID_Continue with General_Category Mn or Mc,
                               minus Default_Ignorable_Code_Point, before SegmentStarter
```

The grammar recognizes source spelling and emits a tag identifier as follows:

- Each `SegmentStarter`, `ValueUnit`, and contextually valid `ApostropheJoiner` emits its exact source code-point sequence. A `FullyQualifiedEmoji`
  therefore emits its complete matched sequence.
- Each consumed `/` emits one U+002F SOLIDUS into the identifier.
- `Introducer`, `IgnoredDefaultIgnorable`, and `IgnoredLeadingCombiningMark` emit nothing.

At every source position, the token priority is the longest `FullyQualifiedEmoji`, then `IgnoredDefaultIgnorable`, then `IgnoredLeadingCombiningMark`, then
a contextually valid `ApostropheJoiner`, then an emitted code point or Memos extension unit. This preserves default-ignorable code points inside matched
fully-qualified emoji sequences while omitting them everywhere else.

The emitted tag identifier is the direct tag value.

Rules:

1. `EmittedXIDContinueCodePoint` is a Unicode code point with the `XID_Continue` property in Unicode 17.0, minus
   `Default_Ignorable_Code_Point` in Unicode 17.0.
2. `EmittedXIDContinueCodePointExceptCombiningMark` additionally excludes General Category `Mn` and `Mc` code points.
3. `_` is already included in `XID_Continue` and is not a separate extension.
4. `FullyQualifiedEmoji` is a code-point sequence whose `RGI_Emoji_Qualification` value is `Fully_Qualified`, represented by status `fully-qualified` in
   the Emoji 17.0 `emoji-test.txt` data. It is matched atomically and before any shorter unit. The `Standalone_Component` value, represented by status
   `component`, is not included.
5. The raw union of `Extended_Pictographic` and `Emoji_Component` is not used. That union admits bare `*`, isolated emoji components, invisible emoji tag
   characters, and code points reserved for future emoji.
6. U+0023 ASCII NUMBER SIGN is the only tag introducer, but a `#` already matched inside the fully-qualified keycap sequence `#️⃣` is an emoji unit rather
   than an introducer. U+FE5F SMALL NUMBER SIGN and U+FF03 FULLWIDTH NUMBER SIGN are ordinary text.
7. An ordinary `#` that does not begin a `FullyQualifiedEmoji` terminates the current identifier and may introduce another tag. The `#` in `#️⃣` is
   preserved as part of that atomic emoji value unit under the same longest-match rule as every other admitted emoji.
8. Numeric-only and emoji-only identifiers are valid.
9. `/` is a hierarchy separator and is consumed only between two non-empty segments. It cannot begin or end an identifier, and two `/` separators cannot be
   adjacent.
10. `-`, `+`, and `&` are Memos-specific segment-unit extensions. They are allowed at any position, may repeat, and may form an entire segment.
11. Default-ignorable code points inside a `FullyQualifiedEmoji` are preserved as part of that atomic value unit. Any other
   `Default_Ignorable_Code_Point` is consumed as part of the source spelling but emits no code point into the direct tag value. Ignored code points do not
   by themselves make a segment non-empty.
12. A non-default-ignorable `XID_Continue` code point whose General Category is `Mn` (Nonspacing Mark) or `Mc` (Spacing Combining Mark) is consumed but
    omitted while it precedes the starter of its segment. The same non-default-ignorable code point is preserved as a value unit after that segment's
    starter.
13. After applying the longest-`FullyQualifiedEmoji` token priority, U+0027 APOSTROPHE and U+2019 RIGHT SINGLE QUOTATION MARK are emitted as
    `ApostropheJoiner` only when the immediately preceding source code point in the same segment was emitted as an `EmittedXIDContinueCodePoint` and the
    immediately following source code point can emit as an
    `EmittedXIDContinueCodePointExceptCombiningMark`. An apostrophe joiner therefore cannot start or end a segment, repeat without an intervening XID
    code point, adjoin a fully-qualified emoji or Memos extension unit, or join across an ignored code point.
14. U+02BC MODIFIER LETTER APOSTROPHE (`ʼ`) is already an `XID_Continue` code point. It follows the ordinary XID rules rather than the contextual
    apostrophe-joiner rule.
15. There is no tag-specific identifier length limit. The enclosing memo-size limit provides the resource bound.

The grammar is intentionally broader than a programming-language identifier grammar. It does not require the first emitted unit to be `XID_Start`:
digits, `_`, `-`, `+`, `&`, and fully-qualified emoji can start a segment. Default-ignorable code points and non-default-ignorable `Mn` or `Mc` code points
may occur before each segment's starter but are omitted from the value. After the starter, those non-default-ignorable `Mn` and `Mc` code points are
preserved. ASCII and right-curly apostrophes are emitted only as contextual joiners between XID code points. A slash cannot begin a segment, and segments
made only from `-`, `+`, and `&` are explicitly valid.

### Maximal-prefix scanning

After finding an introducer, the lexer consumes the longest valid `TagSourceSpelling` within the current literal-source run:

1. Before each segment's starter, consume default-ignorable code points and non-default-ignorable `XID_Continue` code points in General Category `Mn` or
   `Mc` into the source spelling without emitting them.
2. Emit a segment starter, trying the longest matching `FullyQualifiedEmoji` before any shorter unit.
3. After the starter, preserve non-default-ignorable `XID_Continue` combining marks as ordinary value units; continue consuming default-ignorable code
   points without emitting them.
4. Emit U+0027 or U+2019 as an apostrophe joiner only when, after emoji-first tokenization, the immediately preceding source code point emitted an XID
   continuation unit and the immediately following source code point can emit a non-combining XID continuation unit. Otherwise stop before the
   apostrophe.
5. Consume `/` only when the following source, after any ignored prefix, can emit a segment starter; then consume that segment.
6. Stop before a `/` that is leading, trailing, or followed only by an ignored prefix and then another `/`, a non-starter, or the end of the literal-source
   run, leaving that slash and the remaining source unconsumed.
7. Otherwise stop before the first code point that cannot begin a valid continuation unit.
8. Keep the valid prefix already consumed; a later invalid character does not invalidate it.
9. Produce no candidate if the first `TagSegmentSpelling` cannot match.

### Candidate enumeration

Candidate discovery and identifier scanning use the same token priority:

1. Match the longest `FullyQualifiedEmoji` at the current position before interpreting any constituent code point separately. Outside an active tag
   candidate, advance past the complete sequence.
2. If no emoji sequence matches and the current code point is an introducer, scan a tag candidate.
3. After a successful candidate, continue at the first unconsumed source position. An ordinary terminating `#` is therefore reconsidered as a possible next
   introducer.
4. After a failed introducer, advance by one code point so an adjacent `#` is still considered.
5. Otherwise, advance by one code point.

This produces:

```text
#️⃣             -> no tag; the source is one emoji
##️⃣            -> #️⃣
#first#️⃣       -> first#️⃣
#first#second  -> first, second
##tag           -> tag
```

Examples:

| Source | Identifier | Remaining source |
| --- | --- | --- |
| `#foo,bar` | `foo` | `,bar` |
| `#foo.bar` | `foo` | `.bar` |
| `#foo:bar` | `foo` | `:bar` |
| `#x=y` | `x` | `=y` |
| `#price€` | `price` | `€` |
| `#C++` | `C++` | empty |
| `#R&D` | `R&D` | empty |
| `#tag's` | `tag's` | empty |
| `#сім'я` | `сім'я` | empty |
| `#O’Brien` | `O’Brien` | empty |
| `#café's` | `café's` | empty |
| `#users'` | `users` | `'` |
| `#foo'1️⃣` | `foo` | `'1️⃣` |
| `#'tag` | none | `'tag` |
| `#-foo` | `-foo` | empty |
| `#foo-` | `foo-` | empty |
| `#---` | `---` | empty |
| `#&&` | `&&` | empty |
| `#A‍B` | `AB` | empty |
| `#‍foo` | `foo` | empty |
| `#A‌B` | `AB` | empty |
| `#‌foo` | `foo` | empty |
| `#A️B` | `AB` | empty |
| `#́foo` | `foo` | empty |
| `#́` | none | U+0301 COMBINING ACUTE ACCENT |
| `#café` | `café` | empty |
| `#work/notes` | `work/notes` | empty |
| `#foo/́bar` | `foo/bar` | empty |
| `#book/` | `book` | `/` |
| `#/book` | none | `/book` |
| `#book//fiction` | `book` | `//fiction` |
| `#book/fiction/` | `book/fiction` | `/` |
| `#foo\+bar` | `foo` | `\+bar` |
| `#R&amp;D` | `R` | `&amp;D` |

For the source below, the identifier is `foo`; the inline-code span begins immediately afterward:

```markdown
#foo`test`
```

### Introducer boundary

There is no general character boundary before the introducer. The following all contain the identifier `tag`:

```text
#tag
hello#tag
中文#tag
```

This intentionally differs from the flowing-text boundary recommendation in UAX #31. Memos can distinguish URL fragments using its Markdown parser and
does not need to approximate URLs by forbidding a letter or number before `#`.

An ordinary `#` is a hard boundary between identifiers:

```text
#first#second  -> first, second
##tag          -> tag, introduced by the second #
## tag         -> no tag; this is an ATX heading marker followed by text
```

### Markdown-context validation

Markdown parsing first divides the original source into literal-source runs and records each run's enclosing context. Lexical scanning then finds candidates
within, but never across, those runs. A candidate becomes a tag occurrence only when its complete source span is in eligible text under GFM 0.29-gfm plus
the declared Memos extensions.

The lexer reads literal characters from each literal-source run's original source range. It does not scan a decoded or rendered text-node value. A Markdown
escape, character reference, or other syntax node is a hard boundary that a candidate cannot cross.

Tag occurrences are allowed in text contained by formatting and block structure, including emphasis, strong emphasis, strikethrough, headings, lists,
quotes, and table cells.

Tag occurrences do not arise from source that is:

- Escaped by Markdown, as in `\#tag`.
- Inside inline code, fenced code, or indented code.
- Anywhere inside a Markdown link, autolink, GFM literal URL, link reference, image, or image alt text.
- Inside raw HTML syntax or an opaque raw HTML block.
- Inside an opaque Memos extension node, including inline or block math.

Consequently, a character reference that renders as `#` is not an introducer, and syntax that renders as an otherwise valid tag unit does not join the
literal source on either side:

```text
&#35;tag     -> no tag
&num;tag     -> no tag
#foo\+bar    -> foo
#R&amp;D     -> R
#R&D         -> R&D
```

The complete link-like node is excluded, not only its destination. Therefore neither the label nor destination produces a tag:

```markdown
[release #notes](https://example.com/releases#notes)
```

Context is determined by the Markdown syntax tree or AST, not by a second URL regular expression. This has two important consequences:

```text
https://example.com/path#tag  -> no tag when parsed as a URL/autolink
/path#tag                     -> tag when the text is not parsed as a link
```

Text between inline HTML tags may still contain a tag when the Markdown parser exposes that text as an ordinary text node. The HTML markup itself and
opaque HTML blocks are never scanned.

### Extracted value and source span

- The extracted direct tag value contains the emitted identifier only, never the introducer.
- The recognized source span contains the introducer and the entire consumed source spelling.
- Highlighting and inline rendered tag markup use that full source span and preserve its source spelling; derived tag labels use the display value.
- Completion replaces the consumed source spelling after the introducer; it does not replace preceding prose.
- The original source spelling is preserved. Case folding and normalization must not occur before lexical boundaries are found.
- A default-ignorable code point outside a matched fully-qualified emoji sequence or an ignored leading combining mark before any segment's starter belongs
  to the recognized source span but is omitted from the extracted value.

For example, `##tag` extracts the value `tag`, while the recognized source span is the second `#tag`.

For `#A‍B`, the recognized source span contains `#`, `A`, U+200D ZWJ, and `B`, while the extracted direct value is the two-code-point string `AB`.

For `#́foo`, the recognized source span includes the leading U+0301 COMBINING ACUTE ACCENT, while the extracted direct value is `foo`. In `#café`, the
same U+0301 follows a segment starter and remains part of the extracted value.

### Identifier equality

The comparison key is the emitted display value. Two identifiers are equal only when their emitted Unicode code-point sequences are identical. Source
spellings that differ only by ignored default-ignorable code points or ignored leading combining marks therefore compare equal.

Memos does not apply case folding, canonical normalization, compatibility normalization, width folding, locale-sensitive comparison, or accent folding when
deduplicating, counting, filtering, navigating, or performing exact metadata lookup. Consequently, each pair below contains two distinct tags:

```text
#Work       / #work
#café       / #café
#Ａ          / #A
#straße     / #STRASSE
#O'Brien    / #O’Brien
#O’Brien    / #OʼBrien
```

Multiple occurrences that emit exactly equal direct tag values in one memo produce one memo-tag membership. A tag metadata rule may deliberately match
several distinct tags, but that rule does not change their identity.

Lexical emission applies only when recognizing Markdown source. An operand supplied to an exact filter or metadata lookup is already a tag value: it is
compared as supplied and is not re-lexed or stripped of code points.

For example, `#AB`, `#A‍B`, and `#A‌B` all emit the comparison key `AB`; `#foo` and `#́foo` both emit `foo`. Each group contributes one tag membership if its
spellings occur in the same memo. Their Markdown source remains unchanged.

### Hierarchy and memo membership

The slash `/` is a structural hierarchy separator, not an opaque character in a tag value. A direct tag value contributes itself and every slash-delimited
ancestor prefix to the memo tag set:

```text
Source occurrence:  #book/fiction/history
Direct tag value:   book/fiction/history
Memo tag set:       book, book/fiction, book/fiction/history
```

Hierarchy expansion has the following domain semantics:

- `Memo.tags` exposes both direct values and implied ancestors.
- Exact membership filtering for an ancestor matches a memo containing only a descendant occurrence.
- A tag count is the number of memo tag sets containing that value. One memo contributes at most one count to each direct or implied tag.
- Rendering and export preserve the one source occurrence; hierarchy expansion does not insert ancestor hashtags into Markdown.

Every hierarchy segment is non-empty. A leading slash produces no candidate; a trailing or repeated slash terminates the identifier before that slash under
the maximal-prefix rule.

### Pinned Unicode and emoji data

Tag recognition is pinned to Unicode 17.0 and Emoji 17.0. Go, browser, and Node runtime tables are not implicitly normative.

The pinned Unicode property assignments and Emoji data are normative, rather than the tables supplied by a particular runtime. Updating either data set
requires an explicit specification change because newly assigned `XID_Continue` characters and newly fully-qualified emoji sequences change what source
text means. Effects on existing data after such an update are outside scope.

## Conformance examples

The following examples are normative for the lexical and context decisions already made:

| Source | Extracted identifiers | Reason |
| --- | --- | --- |
| `#tag` | `tag` | Basic identifier |
| `hello#tag` | `tag` | No general left boundary |
| `#标签` | `标签` | Multilingual XID characters |
| `#2026` | `2026` | Numeric-only identifiers are valid |
| `#C++` | `C++` | Explicit `+` extension |
| `#R&D` | `R&D` | Explicit `&` extension |
| `#tag's` | `tag's` | ASCII apostrophe joins two XID code points |
| `#сім'я` | `сім'я` | ASCII apostrophe preserves a Ukrainian word |
| `#O’Brien` | `O’Brien` | Right single quotation mark joins two XID code points |
| `#café's` | `café's` | An emitted combining mark may precede an apostrophe joiner |
| `#users'` | `users` | A trailing apostrophe is not a joiner |
| `#foo'1️⃣` | `foo` | Emoji-first tokenization prevents an apostrophe from adjoining the keycap sequence |
| `#'tag` | none | An apostrophe cannot start a segment |
| `'#tag'` | `tag` | Surrounding quotation punctuation remains outside the occurrence |
| `#rock’n’roll` | `rock’n’roll` | Multiple apostrophe joiners are valid when each independently satisfies the context rule |
| `#OʼBrien` | `OʼBrien` | U+02BC is an ordinary `XID_Continue` code point |
| `#` followed by 101 `a` code points | all 101 `a` code points | There is no tag-specific length limit |
| `#-foo` | `-foo` | Visible connector extensions may begin a segment |
| `#foo-` | `foo-` | Visible connector extensions may end a segment |
| `#---` | `---` | A segment may contain only visible connector extensions |
| `#&&` | `&&` | Visible connector extensions may repeat |
| `#A‍B` | `AB` | A non-emoji ZWJ is consumed but omitted from the value |
| `#‍foo` | `foo` | An ignored leading ZWJ does not prevent a later value unit from starting the segment |
| `#A‌B` | `AB` | A non-emoji ZWNJ is consumed but omitted from the value |
| `#‌foo` | `foo` | An ignored leading ZWNJ does not prevent a later value unit from starting the segment |
| `#‍‌` | none | Ignored default-ignorable code points alone do not form a segment |
| `#A️B` | `AB` | A default-ignorable variation selector outside a matched fully-qualified emoji is omitted even after a starter |
| `#́foo` | `foo` | A non-default-ignorable combining mark before the segment starter is consumed but omitted |
| `#́` | none | Leading combining marks alone do not form a segment |
| `#café` | `café` | A non-default-ignorable combining mark after the segment starter is preserved |
| `#work/notes` | `work/notes` | Direct hierarchical identifier; memo membership also includes `work` |
| `#foo/́bar` | `foo/bar` | Ignored leading combining-mark handling restarts for each segment |
| `#book/` | `book` | A trailing slash is not consumed |
| `#/book` | none | A hierarchy cannot begin with an empty segment |
| `#book//fiction` | `book` | A repeated slash terminates before the first slash |
| `#book/fiction/` | `book/fiction` | The valid hierarchical prefix is retained |
| `#l·l` | `l·l` | Middle dot is `XID_Continue` |
| `#foo‿bar` | `foo‿bar` | Connector punctuation is `XID_Continue` |
| `#*️⃣` | `*️⃣` | Fully-qualified keycap sequence |
| `#‼️` | `‼️` | Fully-qualified emoji sequence |
| `#♥` | none | Bare text-presentation symbol is neither XID nor fully-qualified emoji |
| `#♥️` | `♥️` | Fully-qualified emoji sequence |
| `#🏻` | none | A standalone emoji component is excluded from `FullyQualifiedEmoji` |
| `#foo,` | `foo` | Comma terminates the identifier |
| `#price€` | `price` | Currency symbol terminates the identifier |
| `#€budget` | none | The first body character is not a unit |
| `#v²` | `v` | `Other_Number` is not generally `XID_Continue` |
| `#first#second` | `first`, `second` | Ordinary `#` terminates and starts candidates |
| `#️⃣` | none | The complete source is a fully-qualified emoji, not an introducer plus identifier |
| `##️⃣` | `#️⃣` | The first `#` introduces the atomic keycap emoji value |
| `#first#️⃣` | `first#️⃣` | The keycap emoji is an ordinary fully-qualified continuation unit |
| `＃tag` | none | Fullwidth number sign is not an introducer |
| `﹟tag` | none | Small number sign is not an introducer |
| `&#35;tag` | none | A character reference is not a literal introducer |
| `&num;tag` | none | Decoded text is not rescanned for candidates |
| `\#tag` | none | Escaped introducer |
| `#foo\+bar` | `foo` | A Markdown escape terminates the literal-source range |
| `#R&amp;D` | `R` | A character reference terminates the literal-source range |
| `#R&D` | `R&D` | A literal ampersand is a value unit |
| `` `#tag` `` | none | Inline-code context |
| `**#urgent**` | `urgent` | Formatted normal text remains eligible |
| `https://example.com/#tag` | none | GFM URL/autolink context |
| `/path#tag` | `tag` | Plain text path is not guessed to be a URL |
| `[hello#tag](https://example.com)` | none | The complete link is excluded |
| `$#tag$` | none | A Memos math node is opaque |

## Consequences

### Positive

- Tag meaning is specified independently of any single parser or issue.
- Common multilingual tags, numeric tags, hierarchy characters, and emoji remain expressive.
- Hierarchical ancestors have one consistent meaning across API membership, exact filters, navigation, and counts.
- `hello#tag` works consistently while actual Markdown links and URLs are excluded structurally.
- Common word-internal apostrophes support multilingual words and names while surrounding quotation punctuation remains outside tag values.
- Unsupported Markdown punctuation, delimiters, currency symbols, and operators stop an identifier predictably; apostrophes are the explicitly
  constrained exception.
- Exact equality preserves every emitted code-point distinction and avoids locale-dependent identity rules.
- Ignoring default-ignorable code points outside emoji avoids invisible tag distinctions while preserving matched fully-qualified emoji sequences.
- Ignoring leading non-default-ignorable `Mn` and `Mc` code points only before each segment's visible starter avoids invisible-leading segments without
  breaking decomposed writing inside words.
- Keeping `-`, `+`, and `&` position-independent avoids a second connector-validation layer.
- The memo-size limit provides the only length bound, avoiding tag-specific counting and overflow rules.
- All consumers can implement the same language contract.
- Unicode repertoire changes require an explicit specification update rather than depending on runtime tables.

### Negative

- Fully-qualified emoji matching requires sequence-aware data, not a simple code-point character class.
- Pinning Unicode data requires maintenance when Unicode and Emoji data are updated.
- Visually indistinguishable or canonically equivalent source spellings whose emitted values differ remain separate tags unless the user edits their memo
  sources to make those values identical.
- Visually similar apostrophe spellings such as U+0027, U+2019, and U+02BC remain distinct under exact tag identity.
- English possessive-looking source such as `#tag's` denotes the complete tag value `tag's`, not `tag` followed by prose.
- Source spellings that differ only by ignored default-ignorable code points intentionally collapse to the same emitted tag value.
- Source spellings that differ only by ignored leading combining marks intentionally collapse to the same emitted tag value.

## Alternatives considered

### Keep `L/M/N/S` and patch URL detection

Rejected. `\p{S}` admits currency, mathematical operators, modifier symbols, and Markdown backticks merely as a side effect of supporting emoji. URL detection
would still differ across consumers and would duplicate the Markdown parser.

### Require a whitespace or punctuation boundary before `#`

Rejected. It makes the intentionally supported `hello#tag` form invalid and uses a lexical approximation to solve a structural URL problem.

### Adopt UAX31-R8 unchanged

Rejected. UAX31-R8 recommends a flowing-text left boundary that does not match the product decision, and its raw emoji component repertoire is broader than
the desired complete-sequence behavior. Memos instead defines an explicit UAX #31 profile.

### Use `Extended_Pictographic | Emoji_Component` as code-point characters

Rejected. It admits bare `*`, isolated modifiers and regional indicators, invisible emoji tag characters, and unassigned code points reserved for future
emoji. Matching only fully-qualified entries expresses the intended user-visible unit.

### Keep the 100-code-point limit

Rejected. The value is arbitrary, counts code points rather than user-perceived characters, and currently has three different overflow behaviors. Memo-size
limits already bound work.

### Reject an entire candidate when a later invalid character appears

Rejected. Hashtags in flowing text conventionally end at punctuation. Maximal-prefix behavior makes `#foo,` and `#foo` followed by inline code predictable.

### Allow empty hierarchy segments

Rejected. Empty segments have no useful navigation or membership meaning and would require special handling in hierarchy expansion. The grammar permits `/`
only between two non-empty segments.

### Reject a whole hierarchy after an invalid slash

Rejected. Keeping the longest valid prefix makes a trailing or repeated slash behave like other terminating syntax and avoids erasing an otherwise valid
tag. The slash and remaining source stay ordinary Markdown.

### Restrict visible connectors by position

Rejected. Requiring `-`, `+`, or `&` to be medial, non-repeating, or accompanied by a letter would add validation rules without resolving a structural
ambiguity. They remain ordinary segment units; only `/` has structural meaning.

### Treat apostrophes as unrestricted value units

Rejected. Allowing apostrophes as starters, trailing units, or repeatable ordinary units would absorb surrounding quotation punctuation into values such
as `tag'` and make quoted source such as `'#tag'` ambiguous. The contextual joiner rule supports words and names while leaving punctuation at tag
boundaries unconsumed.

### Recognize compatibility number signs

Rejected. U+FE5F SMALL NUMBER SIGN and U+FF03 FULLWIDTH NUMBER SIGN are visually similar to `#` but are not Markdown syntax. Recognizing only ASCII U+0023
keeps the introducer rule literal and unambiguous.

### Special-case the number-sign keycap

Rejected. `#️⃣` follows the same longest-sequence matching rule as every other admitted fully-qualified emoji. Excluding it or splitting its code points
would add an exception to the emoji profile.

### Scan decoded Markdown text

Rejected. Decoding character references and escapes before tag scanning would allow non-literal introducers and require source reconstruction for exact
spans. Tag lexing uses original source ranges; Markdown syntax nodes act as boundaries.

### Leave the Markdown dialect parser-defined

Rejected. Parser-dependent context would allow identical source to produce different tags. GFM 0.29-gfm is the structural baseline; additional Memos
extensions are opaque unless explicitly declared transparent to tag recognition.

## References

- [Unicode 17.0 Standard Annex #31: Unicode Identifiers and Syntax](https://www.unicode.org/reports/tr31/tr31-43.html)
- [UAX #31 Hashtag Identifiers](https://www.unicode.org/reports/tr31/tr31-43.html#Hashtag_Identifiers)
- [UAX #31 Emoji Profile](https://www.unicode.org/reports/tr31/tr31-43.html#Emoji_Profile)
- [Unicode Emoji 17.0 (UTS #51)](https://www.unicode.org/reports/tr51/tr51-29.html)
- [Unicode Emoji 17.0 test data](https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt)
- [GitHub Flavored Markdown specification](https://github.github.com/gfm/)
- [Memos tag documentation](https://usememos.com/docs/usage/tags)
