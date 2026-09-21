---
title: "Memos domain glossary"
status: draft
tags:
  - "domain"
---

## Overview

Product and domain language of Memos, the note-taking domain centered on short-form memos and the resources attached to them. The tag table includes the recognition terms of the tag-syntax decision; the grammar, pinned Unicode data, and conformance cases that use them, and protocol-specific terms, stay with the tag and username decisions. The "Avoid" column lists words not to use for the term. Resource patterns and Space roles appear in @proto/api/v1/memo_service.proto and @proto/api/v1/space_service.proto; tag and mention recognition lives in @markdown/parser/tag.go and @markdown/parser/mention.go; the shared UID and username grammar lives in @internal/identifier.

## Content

### Memos

| Term | Definition | Avoid |
| --- | --- | --- |
| Memo ID | The stable internal identity of a memo. It does not change when the memo's public identifier changes. | Memo UID, slug |
| Memo UID | The unique public identifier used in a memo resource name and URL. It is user-defined at creation or generated automatically. | Memo ID, database ID |
| Memo resource name | The API identity of a memo in the form `memos/{memo UID}`. | Memo ID, content ID |
| Memo reaction | A response attached to exactly one memo. Reactions are not a generic mechanism for targeting other kinds of content. | Content reaction, generic reaction, reaction target |
| Memo collection scope | The Space-placement dimension applied to Space-aware memo and derived-resource collections: either `all`, which adds no Space predicate, or one exact Space. An unassigned memo remains part of `all`; unassigned is a placement, not a collection scope. | Unassigned scope, no-Space collection |
| Archived memo collection | The signed-in user's memos in the archived lifecycle state across all placements. It is user-level and independent of the current Space collection scope. | Space archive, Space-scoped archive |

### Spaces

| Term | Definition | Avoid |
| --- | --- | --- |
| Space | An instance-scoped collaboration boundary for accepted members and memo placement. It is not a tenant, folder, or application-wide authorization role. | Tenant, workspace, group |
| Space ID | The stable internal identity of a Space. It is not exposed as the Space's public identifier and is distinct from the public Space UID and the mutable Space title. | Space UID, Space title |
| Space UID | The immutable, instance-wide public identifier assigned when a Space is created. It is user-defined or generated automatically. | Space ID, Space title, slug |
| Space resource name | The API identity of a Space in the form `spaces/{space UID}`. | Space ID, Space title |
| Space title | The mutable, non-unique display label of a Space. | Space UID, Space resource name |
| Space invitation | A pending offer for an existing active Memos user to join a Space with a specified Space role. It grants no membership or Space access until that user accepts it. | Pending membership, direct add |
| Space membership | An accepted relationship between an active Memos user and a Space, carrying either the `ADMIN` or `USER` Space role. | Invitation, application role |

### Users and usernames

| Term | Definition |
| --- | --- |
| User | A durable Memos account. Its stable identity is an internal user ID, not its mutable username or display name. |
| Username | A user-selected, case-sensitive public account identifier used for authentication, user resource names, lookup, and references. Spelling is case-preserving and is not implicitly trimmed or normalized; equality is exact ASCII byte equality. It is distinct from the display name and the internal user ID, and its spelling grants no role and does not establish trust. |
| Writable username | A username accepted for account creation, rename, or automatic provisioning: 1 through 36 ASCII letters, digits, or hyphens, beginning and ending with an ASCII letter or digit. Repeated interior hyphens carry no extra restriction, and an all-digit value is writable because numeric spelling has no special meaning. Internationalized human-readable naming belongs to the display name. |
| Legacy username | A stored username that does not satisfy the writable format but remains readable and addressable for compatibility. New write validation rejects it, and new reference syntaxes do not include it. |
| Username reference | Source text naming an exact, case-sensitive username so Memos can attempt to resolve it to a user ID. The spelling alone is not a durable user binding; stability across rename and reuse needs additional persisted identity that the current username-reference specification does not define. |
| Mention candidate | An eligible memo Markdown source span: an ASCII `@` followed by one complete writable username, subject to the boundary and opaque Markdown-context rules of the active username-reference specification. The ASCII letters, digits, and hyphen admitted in a username block a mention immediately to their right and are consumed into the complete candidate to their left. Other characters receive no special boundary handling. |
| Resolved mention | A mention candidate whose exact username resolves to a user under the consuming operation's existing account-status and visibility policy. User-targeted effects apply to the resolved user ID, not to unresolved source text. |

### Tags

| Term | Definition |
| --- | --- |
| Tag | A classification value in a memo tag set, derived from one or more tag occurrences as a direct tag value or an implied ancestor. It is not a durable entity and cannot be created, owned, or renamed independently; changing its spelling means editing the memo source occurrences. |
| Tag introducer | An ASCII `#` (U+0023) that is not part of a matched fully-qualified emoji sequence and starts a tag candidate. Visually similar fullwidth and small number-sign characters are not introducers. |
| Tag candidate | A tag introducer followed by a source spelling that matches the lexical grammar entirely within one literal-source run, before that run's Markdown context is checked for eligibility. |
| Tag occurrence | A tag candidate whose complete recognized source span lies in eligible tag text: an eligible source span in memo Markdown formed by a tag introducer and its consumed source spelling. The spelling emits a tag identifier, the direct tag value. Recognition rules, including excluded Markdown contexts, belong to the active tag-syntax profile. |
| Literal-source run | A contiguous range of original Markdown source that parsing exposes as literal characters, with no intervening Markdown escape, character reference, syntax token, or node boundary. Each run keeps its enclosing Markdown context for eligibility checks. |
| Eligible tag text | A literal-source run whose enclosing context is classified as textual content by GFM 0.29-gfm or explicitly exposed as ordinary text by a Memos Markdown extension. Extension nodes are opaque by default and produce no tags unless the extension definition opts in. The tag-syntax decision calls this "eligible text". |
| Opaque Markdown node | A GFM syntax node or Memos extension node whose source is not eligible for tag recognition. New extension node types are opaque by default. |
| Source spelling | The exact source substring consumed after the `#` introducer. It includes default-ignorable code points outside matched fully-qualified emoji sequences and ignored leading combining marks before each segment's starter, both of which the lexer ignores. Inline rendering and source-preserving operations use this spelling. |
| Recognized source span | The exact contiguous substring of original Markdown formed by the tag introducer and its complete source spelling. |
| Direct tag value | The identifier emitted from one tag occurrence before hierarchy expansion. Default-ignorable code points outside matched fully-qualified emoji sequences and ignored leading combining marks before each segment's starter are consumed from the source spelling but omitted from this value. |
| Implied ancestor tag | A slash-delimited prefix derived from a direct tag value. |
| Tag segment | A non-empty component of a hierarchical tag identifier. `/` separates segments and is consumed only when another non-empty segment follows; a leading slash produces no tag, and a trailing or repeated slash ends the identifier before that slash. `-`, `+`, and `&` are ordinary segment units at any position, repeated, or as a whole segment. Default-ignorable code points and ignored leading combining marks do not make a segment non-empty. |
| Apostrophe joiner | U+0027 APOSTROPHE (`'`) or U+2019 RIGHT SINGLE QUOTATION MARK (`’`), emitted inside a tag segment only when, after emoji-first tokenization, the immediately preceding source code point emits as an `XID_Continue` code point and the immediately following one emits as a non-combining `XID_Continue` code point. |
| Tag identifier | The non-empty Unicode code-point sequence emitted from a tag source spelling, excluding the introducer and all ignored source code points. |
| Display value | The direct or implied value presented as a derived tag label. Memos does not normalize or case-fold emitted code points for identity; ignored default-ignorable code points and ignored leading combining marks are not part of the display value. |
| Comparison key | The value used for deduplication, counting, filtering, navigation, and exact metadata matching; identical to the emitted display value. Tags compare equal only when their emitted code-point sequences are identical, so case and canonical or compatibility-equivalent spellings stay distinct. Spellings differing only by ignored code points compare equal. Inputs to exact value filters and metadata lookups are already tag values: they are compared as supplied, not re-lexed as source spellings. |
| Memo tag set | The union of direct tag values and their implied ancestors for one memo, exposed as `Memo.tags`. It is rebuildable from the memo's Markdown and is not an authoritative source of tags. Each exactly equal emitted value appears once, even when produced both directly and as an ancestor; spellings stay separate only when they emit different code-point sequences. |
| Tag metadata rule | User configuration that selects tag values and supplies presentation or behavior metadata, such as color or content blurring. It can match multiple values and does not create, own, or rename a tag. |
| Tag count | The number of memo tag sets containing an exactly equal direct or implied tag value, not the number of textual occurrences. |

## Examples

- `Alice` and `alice` are distinct usernames.
- `#book/fiction` produces the direct tag value `book/fiction`; likewise, `#work/notes` emits the tag identifier `work/notes`.
- A direct value of `book/fiction/history` implies the ancestor tags `book` and `book/fiction`.
- A memo containing only `#book/fiction` contributes one to both the `book` and `book/fiction` tag counts.
- A memo with UID `release-notes` has the resource name `memos/release-notes`; a Space with UID `team` has the resource name `spaces/team`.
