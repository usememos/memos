# Memos Domain Glossary

This glossary defines product and domain language shared across Memos design documents. Protocol, Unicode, and parser-specific terms remain in the ADRs
that use them.

## Users and usernames

### User

A durable Memos account. Its stable identity is an internal user ID, not its mutable username or display name.

### Username

A user-selected, case-sensitive public account identifier used for authentication, user resource names, lookup, and references. Username spelling is
case-preserving, is not implicitly trimmed or normalized, and equality is exact ASCII byte equality, so `Alice` and `alice` are distinct usernames. A
username is distinct from both a display name and the user's internal ID. Its spelling does not grant a role or establish that the user is trusted.

### Writable username

A username accepted for account creation, rename, or automatic provisioning. It is 1 through 36 ASCII letters, digits, or hyphens; begins and ends with an
ASCII letter or digit; and may contain repeated interior hyphens without an additional restriction. Numeric spelling has no special meaning, so a value
containing only digits is also a writable username. Internationalized human-readable naming belongs to the user's display name.

### Legacy username

A stored username that does not satisfy the writable format but remains readable and addressable for compatibility. Legacy usernames are not accepted by
new write validation or added to new reference syntaxes.

### Username reference

Source text that names an exact, case-sensitive username so Memos can attempt to resolve it to a user ID. The source spelling alone is not a durable user
binding. Stability across username rename and reuse requires additional persisted identity that the current username-reference specification does not
define.

### Mention candidate

An eligible memo Markdown source span formed by an ASCII `@` followed by one complete writable username. Recognition also applies the boundary and opaque
Markdown-context rules in the active username-reference specification. The same ASCII letters, digits, and hyphen admitted inside a username define the
mention boundaries: they block a mention immediately to their right and are consumed as part of the complete candidate to their left. Other characters
receive no special boundary handling.

### Resolved mention

A mention candidate whose exact username resolves to a user under the consuming operation's existing account-status and visibility policy. User-targeted
effects apply to the resolved user ID, not to unresolved source text.

## Tags

### Tag

A classification value in a memo tag set, derived from one or more tag occurrences either as a direct tag value or as an implied ancestor. A tag is not a
durable entity and cannot be independently created or renamed. Changing a tag's spelling requires editing the relevant memo source occurrences.

### Tag introducer

An ASCII `#` character (U+0023) that is not part of a matched fully-qualified emoji sequence and starts a tag candidate. Visually similar fullwidth and small
number-sign characters are not introducers.

### Tag occurrence

An eligible source span in memo Markdown formed by a tag introducer and its consumed source spelling. The spelling emits a tag identifier, which is the
direct tag value. Recognition rules, including excluded Markdown contexts, are defined by the active tag-syntax profile.

### Eligible tag text

A contiguous original-source range with no intervening Markdown syntax boundary, classified as textual content by GFM 0.29-gfm or explicitly exposed as
ordinary text by a Memos Markdown extension. Extension nodes are opaque by default, so their source does not produce tags unless the extension definition
opts in.

### Source spelling

The exact source substring consumed after the `#` introducer. It includes default-ignorable code points outside matched fully-qualified emoji sequences and
ignored leading combining marks before each segment's starter, both of which the lexer ignores. Inline rendering and source-preserving operations use this
spelling.

### Direct tag value

The identifier emitted from one tag occurrence before hierarchy expansion. `book/fiction` is the direct value produced by `#book/fiction`.
Default-ignorable code points outside matched fully-qualified emoji sequences and ignored leading combining marks before each segment's starter are
consumed from the source spelling but omitted from this value.

### Implied ancestor tag

A slash-delimited prefix derived from a direct tag value. A direct value of `book/fiction/history` implies the ancestor tags `book` and `book/fiction`.

### Tag segment

A non-empty component of a hierarchical tag identifier. `/` separates segments and is consumed only when another non-empty segment follows. A leading slash
produces no tag; a trailing or repeated slash terminates the identifier before that slash. `-`, `+`, and `&` are ordinary segment units: they may appear at
any position, repeat, or form a complete segment. Default-ignorable code points and ignored leading combining marks do not make a segment non-empty.

### Tag identifier

The non-empty Unicode code-point sequence emitted from a tag source spelling. The identifier excludes the introducer and all ignored source code points.

### Display value

The direct or implied value presented as a derived tag label. Memos does not normalize or case-fold emitted code points for identity, but ignored
default-ignorable code points and ignored leading combining marks are not part of the display value.

### Comparison key

The value used for deduplication, counting, filtering, navigation, and exact metadata matching. It is identical to the emitted display value. Two tags
compare as equal only when those emitted Unicode code-point sequences are identical; case and canonical or compatibility-equivalent spellings remain
distinct. Source spellings that differ only by ignored default-ignorable code points or ignored leading combining marks compare equal. Inputs to exact
value filters and metadata lookups are already tag values and are compared as supplied; they are not re-lexed as source spellings.

### Memo tag set

The union of direct tag values and their implied ancestor tags for one memo, exposed as `Memo.tags`. It is rebuildable from the memo's Markdown and is not an
authoritative source of tags. Each exactly equal emitted value appears once, even when produced both directly and as an ancestor. Different source
spellings remain separate only when they emit different code-point sequences.

### Tag metadata rule

User configuration that selects tag values and supplies presentation or behavior metadata, such as color or content blurring. A metadata rule may match
multiple values and does not create, own, or rename a tag.

### Tag count

The number of memo tag sets containing an exactly equal direct or implied tag value, not the number of textual occurrences. A memo containing only
`#book/fiction` contributes one to both the `book` and `book/fiction` counts.
