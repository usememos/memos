# Memos

Memos is the note-taking domain centered on short-form memos and the resources attached to them.

## Language

**Memo ID**:
The stable internal identity of a memo. It does not change when a memo's public identifier changes.
_Avoid_: Memo UID, slug

**Memo UID**:
The unique public identifier used in a memo resource name and URL. It may be user-defined when the memo is created or generated automatically.
_Avoid_: Memo ID, database ID

**Memo resource name**:
The API identity of a memo in the form `memos/{memo UID}`.
_Avoid_: Memo ID, content ID

**Memo reaction**:
A response attached to exactly one memo. Reactions are not a generic mechanism for targeting other kinds of content.
_Avoid_: Content reaction, generic reaction, reaction target

**Space**:
An instance-scoped collaboration boundary for accepted members and memo placement. It is not a tenant, folder, or application-wide authorization role.
_Avoid_: Tenant, workspace, group

**Space ID**:
The stable internal identity of a Space. It is not exposed as the Space's public identifier.
_Avoid_: Space UID, Space title

**Space UID**:
The immutable, instance-wide public identifier assigned when a Space is created. It may be user-defined or generated automatically.
_Avoid_: Space ID, Space title, slug

**Space resource name**:
The API identity of a Space in the form `spaces/{space UID}`.
_Avoid_: Space ID, Space title

**Space title**:
The mutable, non-unique display label of a Space.
_Avoid_: Space UID, Space resource name

**Space invitation**:
A pending offer for an existing active Memos user to join a Space with a specified Space role. It grants no membership or Space access until that user accepts it.
_Avoid_: Pending membership, direct add

**Space membership**:
An accepted relationship between an active Memos user and a Space, carrying either the `ADMIN` or `USER` Space role.
_Avoid_: Invitation, application role

**Memo collection scope**:
The Space-placement dimension applied to Space-aware memo and derived-resource collections. It is either `all`, which adds no Space predicate, or one exact Space. An unassigned Memo remains part of `all`; unassigned is a placement, not a collection scope.
_Avoid_: Unassigned scope, no-Space collection

**Archived memo collection**:
The signed-in user's memos in the archived lifecycle state across all placements. It is user-level and independent of the current Space collection scope.
_Avoid_: Space archive, Space-scoped archive
