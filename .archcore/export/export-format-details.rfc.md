---
title: "Proposed export archive structure"
status: draft
tags:
  - "export"
---

## Summary
Status: Proposed (2026-09-16).

This proposal details the Memos Export Format 1.0 archive: the container layout and rules, identifiers, the manifest, the memo record, the content file, the attachment entry, naming and compatibility, and versioning. The records are normatively defined by @docs/design/memo-export/1.0/manifest.schema.json and @docs/design/memo-export/1.0/memo.schema.json; the container rules below are what the schemas cannot express.

## Motivation
An archive has to survive code refactors and later releases. Records therefore mirror the public API vocabulary instead of Go types or database rows, references use bare UIDs, and memo content keeps its exact bytes. Byte identity lets a re-import reproduce the memo exactly, and a future change to how Memos parses content never invalidates an old archive: the importer stores the bytes, and the current parser derives tags and properties from them, as for a memo created through the API. An explicit minor/major rule lets a reader keep accepting every archive of a major version it knows.

## Detailed Design
### Container layout
```
memos-export-<username>-<YYYYMMDDTHHMMSSZ>.zip
├── manifest.json                  first entry, archive-level record
├── memos/
│   ├── <memo-uid>.json            memo record
│   ├── <memo-uid>.md              memo content, byte-identical
│   └── ...
└── attachments/
    └── <attachment-uid>/<filename>
```

- The archive identifies itself through `manifest.json`, which writers place first. Readers locate it by name, not by position.
- Writers never emit an entry named `mimetype`, because extractors that implement the EPUB and OpenDocument package signature refuse a package whose media type they do not know.
- Every entry name is UTF-8, with the language encoding flag set whenever the name is not ASCII; it uses `/` as the separator and is a relative path.
- Names never contain a `.` or `..` segment, a leading `/`, a backslash, a colon, a NUL, or any C0 control character. Readers reject the whole archive on a violation rather than repairing it.
- Every entry name is ASCII except the final segment of an `attachments/` path, which may be any UTF-8 name that passes the rules above.
- Compression methods are Store (0) and Deflate (8). ZIP64 structures are permitted for size or entry count; encryption, spanning, and other methods are not.
- Readers ignore entries and directories they do not recognize. Writers may add entries in later minor versions.
- A memo record and its content file share the memo UID as basename; neither appears without the other.
- Directory entries are optional. Readers must not depend on their presence.
- Every entry carries the archive's `exportTime` as its modification time, in the MS-DOS date and time fields and in the extended timestamp extra field. An all-zero MS-DOS date is never written, because some extractors, macOS Archive Utility among them, refuse it.

### Identifiers
- A memo is identified by its Memo UID, the `{memo}` segment of `memos/{memo}`, matching `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$`. An attachment is identified by the `{attachment}` segment of `attachments/{attachment}`, with the same grammar.
- A Space is identified by its Space UID and carries its Space title for fallback matching. A user is identified by username. Database identifiers never appear.
- References inside the archive are bare UIDs, never resource names, so the API's resource name patterns can change without a format change.

### Records
Every record is an RFC 8259 JSON text in UTF-8 without a byte order mark, in the proto3 JSON mapping: lowerCamelCase field names, enum values as their proto names, RFC 3339 `date-time` timestamps; fields with default or empty values may be omitted. Timestamps are UTC with the `Z` designator, for example `2026-09-16T08:30:00Z`; writers emit whole seconds and readers accept fractional seconds.

Enum values are the public API strings: `state` is `NORMAL` or `ARCHIVED`; `visibility` is `PRIVATE`, `PROTECTED`, `PUBLIC`, or `SPACE`; relation `type` is `REFERENCE`. A reader that meets an unknown value applies the field's fallback, records a warning, and continues: `NORMAL` for `state`, `PRIVATE` for `visibility`, skipping the relation for `type`. Readers ignore unknown members in any object; this is what lets a minor version add fields.

**manifest.json**, for example: `{"format": "memos-export", "formatVersion": "1.0", "generator": {"name": "memos", "version": "0.31.0"}, "exportTime": "2026-09-16T08:30:00Z", "scope": {"kind": "USER", "user": {"username": "steven", "displayName": "Steven"}}, "counts": {"memos": 1834, "attachments": 212}}`.

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Writers emit `memos-export`. Readers also accept the legacy `memos-archive` identifier. |
| `formatVersion` | yes | `MAJOR.MINOR`; see versioning. |
| `generator` | yes | The software that wrote the archive. Diagnostic only. |
| `exportTime` | yes | When the archive was written. |
| `scope.kind` | yes | `USER` in 1.0. Reserved for later minors: `INSTANCE`, `SPACE`, `SELECTION`. |
| `scope.user` | when kind is `USER` | The user whose memos the archive holds. |
| `counts` | no | Number of memo records and attachment entries; lets readers detect truncation and report progress. |

The manifest carries no per-memo index. The `memos/` directory is the index, which keeps the manifest constant-size and lets writers and readers stream.

**memos/{uid}.json**, for example: `{"uid": "Ab3kZ9q2", "creator": "steven", "createTime": "2026-03-02T14:05:11Z", "updateTime": "2026-03-02T14:20:47Z", "state": "NORMAL", "visibility": "SPACE", "pinned": true, "contentPath": "memos/Ab3kZ9q2.md", "tags": ["work", "work/q3"], "location": {"placeholder": "Office", "latitude": 52.52, "longitude": 13.405}, "space": {"uid": "team-notes", "title": "Team Notes"}, "parent": "Xy7LmN01", "relations": [{"type": "REFERENCE", "memo": "Qr5TuV88"}], "attachments": [{"uid": "att1c9d", "filename": "whiteboard photo.jpg", "type": "image/jpeg", "size": 482113, "sha256": "74a8b503a0dda2a74b87912bd7a61a9f412079a0166f07b565ee736146e67c00", "path": "attachments/att1c9d/whiteboard photo.jpg", "createTime": "2026-03-02T14:05:30Z", "mediaMetadata": {"width": 4032, "height": 3024}}, {"uid": "att77e0", "filename": "spec.pdf", "type": "application/pdf", "size": 120400, "externalLink": "https://files.example.com/spec.pdf", "createTime": "2026-03-02T14:06:02Z"}], "reactions": [{"reactionType": "👍", "creator": "alice", "createTime": "2026-03-03T09:00:00Z"}]}`.

| Field | Required | Round-trips | Notes |
| --- | --- | --- | --- |
| `uid` | yes | yes | Import key. Must equal the file basename. |
| `creator` | yes | no in 1.0 | Username at export time; in a `USER` archive it equals `scope.user.username`. Present so multi-author archives are additive. |
| `createTime`, `updateTime` | yes | yes | Both are caller-settable on memo creation in the public API. |
| `state` | yes | yes | |
| `visibility` | yes | yes | `SPACE` requires a resolvable `space`; otherwise the importer falls back to `PRIVATE` with a warning. |
| `pinned` | yes | yes | |
| `contentPath` | yes | yes | Archive path of the content file. Writers use `memos/<uid>.md`; readers follow the field, never the convention, so a minor version can move the layout. |
| `tags` | no | derived | Informational. Tags are derived from content on import; readers never write them. |
| `location` | no | yes | Mirrors the API `Location` message; `latitude` and `longitude` are WGS 84 decimal degrees. |
| `space` | no | best effort | Matched by `uid`, then by `title` among Spaces the importer is a member of, else the memo is imported Unassigned. |
| `parent` | no | yes | UID of the memo this one comments on; a record with `parent` is a comment. It represents the API's immutable `COMMENT` relation. |
| `relations` | no | yes | Outgoing `REFERENCE` relations only. |
| `attachments` | no | yes | Presentation order; see the attachment entry. |
| `reactions` | no | no in 1.0 | Informational. Mirrors the API `Reaction` message with `creator` as a username. |

**memos/{uid}.md** holds the exact bytes of the memo `content` field: UTF-8, no byte order mark, no added trailing newline, no front matter, and no rewriting of links or attachment references.

**Attachment entry**:

| Field | Required | Notes |
| --- | --- | --- |
| `uid` | yes | Attachment UID. |
| `filename` | yes | Original filename, authoritative. The archive path may differ after the safe-name mapping. |
| `type` | yes | IANA media type, for example `image/jpeg`. |
| `size` | yes | Byte length of the content. |
| `sha256` | when `path` is present | Lowercase hexadecimal SHA-256 of the bytes; used for integrity and to skip uploading bytes the instance already holds. |
| `path` | one of `path`, `externalLink` | Archive entry holding the bytes; always `attachments/<uid>/<safe-filename>`. |
| `externalLink` | one of `path`, `externalLink` | External attachments carry no bytes. |
| `createTime` | yes | Informational in 1.0, because attachment creation time is output-only in the API; preserved so importers can apply it once the API accepts it. |
| `mediaMetadata` | no | The API `MediaMetadata` message in its JSON mapping. Informational; the importer re-derives it from the bytes. |

The safe filename is `filename` after replacing each `/`, `\`, `:`, NUL, and C0 control character with `_`, trimming leading and trailing spaces and dots, prefixing `_` when the stem is a reserved Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`), and substituting `file` when the result is empty. Writers apply the mapping; readers only validate the container rules and rely on `filename`. An attachment belongs to exactly one memo record; attachments linked to no memo are not exported.

### Naming and compatibility
The product actions are **Export memos** and **Import memos**. **Memos Export Format** names the file format and is unrelated to a memo's **Archived** state. The Go package is `core/memoexport` (@core/memoexport/format.go).

Before 0.31.0 stable the format was named Memo Archive. New exports use `format: "memos-export"`, the media type `application/vnd.usememos.export+zip`, and the filename prefix `memos-export-`. Readers keep accepting `format: "memos-archive"`, and the file picker also accepts the old `application/vnd.usememos.archive+zip` media type. Import validates the manifest and does not depend on the filename or media type. The ZIP layout and record semantics are unchanged, so `formatVersion` stays `1.0`. The original prerelease fixture stays in @core/memoexport/testdata/1.0/legacy.zip and is tested alongside the current fixture.

### Versioning and evolution
`formatVersion` is `MAJOR.MINOR`. Readers accept any minor version of a major they know: a 1.0 reader accepts a 1.7 archive, ignores members and entries it does not understand, and applies the enum fallbacks. Readers refuse an unknown major version with a message naming both versions. Writers emit the newest version they implement.

A change is a minor bump when it only adds optional members, adds entries, adds enum values whose fallback is acceptable for older readers, or adds `scope.kind` values. Every other change is a major bump: removing or renaming a member, changing a member's type or meaning, changing the container rules, making an optional member required, or adding an enum value whose fallback would silently change meaning. Within a major version a member is never removed; a member that stops being useful is marked deprecated in the schema, and writers keep emitting it.

Each version has its own schema directory, `docs/design/memo-export/<MAJOR.MINOR>/`, and a golden archive under test data (@core/memoexport/testdata/1.0/golden.zip). CI imports every golden archive ever published, so a reader regression against an older version fails the build.

## Drawbacks
- The identifier transition is a prerelease break: older prerelease readers that only accept `memos-archive` cannot read new exports.
- `creator` and `reactions` do not round-trip in 1.0, and attachment `createTime` and `mediaMetadata` are informational only.
- One unsafe entry name rejects the whole archive; readers never repair it.
- Within a major version, deprecated members stay in the schema and writers keep emitting them.

## Alternatives
- **Locating the manifest by position or a leading `mimetype` entry** — rejected because extractors that implement the EPUB and OpenDocument signature refuse a package with an unknown media type; readers locate `manifest.json` by name.
- **Resource names as references** — rejected because bare UIDs let the API's resource name patterns change without a format change.
- **A per-memo index in the manifest** — rejected because the `memos/` directory already is the index, keeping the manifest constant-size and letting writers and readers stream.
- **Readers following the `memos/<uid>.md` convention** — rejected because following `contentPath` lets a minor version move the layout.
- **Repairing unsafe entry names on read** — rejected because entry names are validated, never sanitized, against path traversal (CWE-22).
