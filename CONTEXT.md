# Memos

Memos is the note-taking domain centered on short-form memos and the resources attached to them. See [the domain glossary](docs/glossary.md)
for the complete shared vocabulary.

## Language

**Instance**:
One deployed Memos site with its own users, settings, memos, and storage.

**Instance access mode**:
The policy that controls whether anonymous users can read eligible public content. It is either private or public.
_Avoid_: Site visibility

**Memo**:
One author-owned note. A memo has Markdown content, one creator, one lifecycle, and optional attachments, relations, reactions, location, and Space placement.

**Memo ID**:
The stable internal identity of a memo. It does not change when a memo's public identifier changes.
_Avoid_: Memo UID, slug

**Memo UID**:
The unique public identifier used in a memo resource name and URL. It may be user-defined when the memo is created or generated automatically.
_Avoid_: Memo ID, database ID

**Memo resource name**:
The API identity of a memo in the form `memos/{memo UID}`.
_Avoid_: Memo ID, content ID

**Memo audience**:
The reader group selected for one memo. Current audiences are private, protected, public, and Space. The v1 API represents this as `visibility`.
_Avoid_: Access level

**Comment memo**:
An independent memo connected to another memo by a `COMMENT` relation. It keeps its own placement, audience, authorship, and lifecycle.
_Avoid_: Reply record, child note

**Memo reaction**:
A response attached to exactly one memo. Reactions are not a generic mechanism for targeting other kinds of content.
_Avoid_: Content reaction, generic reaction, reaction target

**Memo share**:
A share link that grants access to one exact memo through a share token. It does not grant feed, Space, or related-memo access.

**Space**:
An instance-scoped collaboration boundary for accepted members and memo placement. It is not a tenant, folder, or application-wide authorization role.
_Avoid_: Tenant, workspace, group

**Unassigned memo**:
A memo with no Space placement. Unassigned is an absence of placement, not a Space or collection scope.

**Space invitation**:
A pending offer for an existing active Memos user to join a Space with a specified Space role. It grants no membership or Space access until that user accepts it.
_Avoid_: Pending membership, direct add

**Space membership**:
An accepted relationship between an active Memos user and a Space, carrying either the `ADMIN` or `USER` Space role.
_Avoid_: Invitation, application role

**Memo collection scope**:
The Space-placement dimension applied to Space-aware memo and derived-resource collections. It is either `all`, which adds no Space predicate, or one exact
Space. An unassigned memo remains part of `all`.
_Avoid_: Unassigned scope, no-Space collection

**Archived memo collection**:
The signed-in user's memos in the archived lifecycle state across all placements. It is user-level and independent of the current Space collection scope.
_Avoid_: Space archive, Space-scoped archive

**Attachment**:
A file or external link that can be linked to a memo. An attachment has one resource identity and can have stored media metadata.

**Memo Markdown**:
The Markdown source text of a memo. It is the source of truth for tags, mentions, snippets, and computed memo properties.

**Effective configuration**:
The configuration used by the running instance. Deployment configuration shadows stored configuration with the same stable key.
