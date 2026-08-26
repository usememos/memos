# Memos Domain Glossary

This glossary defines product and domain language shared across Memos design documents. Protocol, Unicode, and parser-specific terms remain in the ADRs
that use them. [Memos context](../CONTEXT.md) contains a compact subset for design documents that need only the central terms.

## Product and access

### Memos

Memos is the product and application for author-owned short-form notes called memos. Use this term for the note-taking app, not for one note.

_Avoid_: Memo app

### Instance

One deployed Memos site with its own users, settings, memos, and storage.

### Instance access mode

The policy that controls whether anonymous users can read eligible public content. It is either private or public.

_Avoid_: Site visibility

### Application role

A role on the Memos instance. The current roles are `ADMIN` and `USER`. An application `ADMIN` is not automatically a Space member.

## Users and usernames

### User

A durable Memos account. Its stable identity is an internal user ID, not its mutable username or display name.

### Display name

A human-readable name for a user. It is not the username and is not a stable account identity.

### Identity provider

An external single sign-on provider that can authenticate users for an instance.

_Avoid_: IdP account

### Linked identity

The binding between one Memos user and one identity-provider subject.

### Personal Access Token

A long-lived token for API or script access. It is distinct from short-lived access tokens and refresh-token cookies.

_Avoid_: Session token

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

## Memos and content

### Memo

One author-owned note. A memo has Markdown content, one creator, one lifecycle, and optional attachments, relations, reactions, location, and Space placement.

### Memo ID

The stable internal identity of a memo. It does not change when the memo's public identifier changes.

_Avoid_: Memo UID, slug

### Memo UID

The unique public identifier used in a memo resource name and URL. It can be user-defined when the memo is created or generated automatically.

_Avoid_: Memo ID, database ID

### Memo resource name

The API identity of a memo in the form `memos/{memo UID}`.

_Avoid_: Memo ID, content ID

### Memo state

The lifecycle state of a memo. Current states are normal and archived.

### Memo audience

The reader group selected for one memo. Current audiences are private, protected, public, and Space. The v1 API represents this as `visibility`.

_Avoid_: Access level

### Private memo

A memo that only its creator can read.

### Protected memo

A memo that active signed-in users of the instance can read.

### Public memo

A memo that active signed-in users can read. Anonymous users can also read it when the instance access mode permits this.

### Space memo

A memo whose audience is active members of its assigned Space. A Space memo must be assigned to a Space.

### Comment memo

An independent memo connected to another memo by a `COMMENT` relation. It keeps its own placement, audience, authorship, and lifecycle.

_Avoid_: Reply record, child note

### Memo relation

A connection between two memos. Current relation types are `REFERENCE` and `COMMENT`.

### Reference relation

A mutable relation that connects one memo to another as a reference.

### Comment relation

An immutable relation that records the context memo for a comment memo. It does not transfer ownership or lifecycle authority.

### Memo reaction

A response attached to exactly one memo. Reactions are not a generic mechanism for targeting other kinds of content.

_Avoid_: Content reaction, generic reaction, reaction target

### Memo share

A share link that grants access to one exact memo through a share token. It does not grant feed, Space, or related-memo access.

### Memo view

A user-owned named filter that can be reused to list memos.

### Memo collection scope

The Space-placement dimension applied to Space-aware memo and derived-resource collections. It is either `all`, which adds no Space predicate, or one exact
Space. An unassigned memo remains part of `all`.

_Avoid_: Unassigned scope, no-Space collection

### Archived memo collection

The signed-in user's memos in the archived lifecycle state across all placements. It is user-level and independent of the current Space collection scope.

_Avoid_: Space archive, Space-scoped archive

## Spaces

### Space

An instance-scoped collaboration boundary for accepted members and memo placement. It is not a tenant, folder, group, or application-wide authorization
role.

_Avoid_: Tenant, workspace, group

### Unassigned memo

A memo with no Space placement. Unassigned is an absence of placement, not a Space.

### Space invitation

A pending offer for an existing active Memos user to join a Space with a specified Space role. It grants no membership or Space access until that user
accepts it.

_Avoid_: Pending membership, direct add

### Space membership

An accepted relationship between an active Memos user and a Space. It carries a Space role.

_Avoid_: Invitation, application role

### Space role

A role inside one Space. Current Space roles are `ADMIN` and `USER`.

### Space feed

A member-only list of readable non-comment memos assigned to one Space.

## Attachments and media

### Attachment

A file or external link that can be linked to a memo. An attachment has one resource identity and can have stored media metadata.

### Managed attachment

An attachment whose content is stored by the Memos instance, not only linked as an external URL.

### Attachment storage

The configured place where new managed attachment content is stored. Current storage types are database, local filesystem, and S3-compatible object
storage.

### Media metadata

Normalized photo or video data supplied by a client and stored with an attachment. The server validates this data but does not extract it from the media
file or use it as a source for image transformation.

### Motion media

Metadata that groups a still image, video, or container that belongs to a live-photo or motion-photo set.

### Location

Optional geographic data attached to a memo or media item.

## Memo Markdown

### Memo Markdown

The Markdown source text of a memo. It is the source of truth for tags, mentions, snippets, and computed memo properties.

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

## Configuration and integrations

### Stored configuration

Instance configuration stored in the application database.

### Deployment configuration

Configuration loaded from deployment-supplied files during process startup.

### Effective configuration

The configuration used by the running instance. Deployment configuration shadows stored configuration with the same stable key.

### Stable key

The identity used to merge deployment configuration with stored configuration. For identity providers this is the provider UID. For instance settings this
is the setting key.

### Webhook

A user-owned outbound HTTP delivery configured for memo events.

### Inbox message

A user notification record shown in the inbox for memo comment or memo mention activity.

_Avoid_: Email message

## Open language questions

### Resolved mention stability after username rename or reuse

Current source text names a username and resolves when consumed. Do not state that old mention source text stays bound to the same user after rename or
reuse until a durable binding is defined.
