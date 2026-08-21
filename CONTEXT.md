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
