# Memos Export Format

Status: Implemented

Date: 2026-09-16

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [Multi-Spaces Design](multi-spaces.md)

Normative schemas: [`memo-export/1.0/manifest.schema.json`](memo-export/1.0/manifest.schema.json), [`memo-export/1.0/memo.schema.json`](memo-export/1.0/memo.schema.json)

## Summary

Memos Export Format is a ZIP-based format that carries one user's memos and their attachments out of a Memos instance and back into a Memos instance running the same or a later release. It is the single format for personal export, personal import, and migration between instances or database backends.

The format is built only from published standards and the public API's own vocabulary. The container is a plain ZIP file as specified by the PKWARE APPNOTE, identified by its manifest. Records are RFC 8259 JSON documents that use the proto3 JSON mapping of the public API messages, so every field name, enum string, and timestamp form is one a client already sees on the wire. Memo content is stored as untouched bytes in a separate Markdown file. Two JSON Schema documents are the normative definition of the records; this document explains them and defines the container and the import semantics that the schemas cannot express.

## Goals

- A memo exported by any Memos release imports into that release and into every later release.
- Importing the same archive twice into the same instance yields the same state as importing it once.
- Moving memos between instances, database backends, or accounts on one instance needs nothing beyond export and import.
- Every field a memo owns through the public API round-trips: content, timestamps, state, visibility, pinned, location, Space placement, references, comment threading, and attachment bytes.
- The format is defined by this document and its schemas, not by Go types, protobuf descriptors, or database rows, so that code refactors cannot change it unintentionally.
- A general-purpose ZIP tool can open the archive and a person can read its contents without Memos.

## Non-goals

- Interoperability with other note-taking products. The archive is written by Memos and read by Memos. Content files are Markdown because memo content is Markdown, not as a portability feature.
- Instance backup. Users, settings, tokens, webhooks, identity providers, and Spaces themselves are not in the archive.
- Exporting other users' memos, comments, or reactions. Version 1.0 archives are personal. The schema reserves room for multi-author archives so that an instance-level export is an additive change.
- Preserving revision history, soft-deleted memos, or share links.
- Encryption or signing.
- A scheduled or continuous writer. The archive is produced on demand.

## Research

The design reuses established specifications rather than inventing encodings. Each choice below names the standard it follows.

| Concern | Standard | Applied as |
| --- | --- | --- |
| Container | PKWARE APPNOTE 6.3.10 (ZIP) | Methods Store (0) and Deflate (8), UTF-8 names via the language encoding flag (bit 11), ZIP64 permitted. |
| Self-identification | RFC 8259 JSON manifest | `manifest.json` carries `format` and `formatVersion`. A leading `mimetype` entry in the EPUB and OpenDocument manner was tried and rejected: macOS Archive Utility recognizes that signature, sees an unknown vendor type, and refuses to expand the file. |
| Media type | RFC 6838 §3.2 vendor tree | `application/vnd.usememos.export+zip` for the container; attachment types are IANA media types. |
| Records | RFC 8259 (JSON), UTF-8 without byte order mark | One JSON document per memo plus one manifest. |
| Record vocabulary | Protocol Buffers proto3 JSON mapping | lowerCamelCase field names, enum names as strings, timestamps as RFC 3339 strings. |
| Timestamps | RFC 3339 §5.6 `date-time` | UTC with `Z` designator. |
| Schema | JSON Schema 2020-12 | Normative `manifest.schema.json` and `memo.schema.json`. |
| Digest | FIPS 180-4 SHA-256 | Lowercase hexadecimal, 64 characters. |
| Path safety | CWE-22 (path traversal in archive extraction, "zip slip") | Entry names are validated, never sanitized; violations reject the archive. |
| Download | RFC 6266 `Content-Disposition` | `attachment; filename*=UTF-8''memos-export-….zip`. |

The container is deliberately an ordinary ZIP file so that every desktop extractor opens it with a double click. The record conventions come from the API the archive mirrors, so the archive needs no vocabulary of its own.

## Proposed design

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

Container rules:

- The archive identifies itself through `manifest.json`, which writers place first. Readers locate it by name, not by position. Writers never emit an entry named `mimetype`, because extractors that implement the EPUB and OpenDocument package signature refuse a package whose media type they do not know.
- Every entry name is UTF-8, with the language encoding flag set whenever the name is not ASCII, uses `/` as the separator, and is a relative path. Names never contain a `.` or `..` segment, a leading `/`, a backslash, a colon, a NUL, or any C0 control character. Readers reject the whole archive on a violation rather than repairing it.
- Every entry name is ASCII except the final segment of an `attachments/` path, which may be any UTF-8 name that passes the rules above.
- Compression methods are Store (0) and Deflate (8). ZIP64 structures are permitted for size or entry count. Encryption, spanning, and other methods are not.
- Readers ignore entries and directories they do not recognize. Writers may add entries in later minor versions.
- A memo record and its content file share the memo UID as basename. Neither appears without the other.
- Directory entries are optional. Readers must not depend on their presence.
- Every entry carries the archive's `exportTime` as its modification time, in the MS-DOS date and time fields and in the extended timestamp extra field. An all-zero MS-DOS date is never written because some extractors, macOS Archive Utility among them, refuse it.

### Identifiers

- A memo is identified by its Memo UID, the `{memo}` segment of `memos/{memo}`, matching `^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$`. An attachment is identified by the `{attachment}` segment of `attachments/{attachment}`, which uses the same grammar. A Space is identified by its Space UID and carries its Space title for fallback matching. Database identifiers never appear.
- A user is identified by username.
- References inside the archive are bare UIDs, never resource names, so the resource name patterns of the API can change without a format change.

### Records

Every record is an RFC 8259 JSON text encoded as UTF-8 without a byte order mark. Records follow the proto3 JSON mapping: field names are lowerCamelCase, enum values are their proto names as strings, timestamps are RFC 3339 `date-time` strings, and fields with default or empty values may be omitted.

Timestamps are always UTC with the `Z` designator, for example `2026-09-16T08:30:00Z`. Writers emit whole seconds. Readers accept fractional seconds.

Enum values are the public API strings: `state` is `NORMAL` or `ARCHIVED`; `visibility` is `PRIVATE`, `PROTECTED`, `PUBLIC`, or `SPACE`; relation `type` is `REFERENCE`. A reader that meets an unknown value applies the documented fallback for that field, records a warning, and continues. Fallbacks are `NORMAL` for `state`, `PRIVATE` for `visibility`, and skipping the relation for `type`.

Readers ignore unknown members in any object. This is what lets a minor version add fields.

#### manifest.json

```json
{
  "format": "memos-export",
  "formatVersion": "1.0",
  "generator": { "name": "memos", "version": "0.31.0" },
  "exportTime": "2026-09-16T08:30:00Z",
  "scope": {
    "kind": "USER",
    "user": { "username": "steven", "displayName": "Steven" }
  },
  "counts": { "memos": 1834, "attachments": 212 }
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | Writers emit `memos-export`. Readers also accept the legacy `memos-archive` identifier. |
| `formatVersion` | yes | `MAJOR.MINOR`. See versioning. |
| `generator` | yes | The software that wrote the archive. Diagnostic only. |
| `exportTime` | yes | When the archive was written. |
| `scope.kind` | yes | `USER` in 1.0. Reserved for later minors: `INSTANCE`, `SPACE`, `SELECTION`. |
| `scope.user` | when kind is `USER` | The user whose memos the archive holds. |
| `counts` | no | Number of memo records and attachment entries. Lets readers detect truncation and report progress. |

The manifest carries no per-memo index. The `memos/` directory is the index, which keeps the manifest constant-size and lets writers and readers stream.

#### memos/{uid}.json

```json
{
  "uid": "Ab3kZ9q2",
  "creator": "steven",
  "createTime": "2026-03-02T14:05:11Z",
  "updateTime": "2026-03-02T14:20:47Z",
  "state": "NORMAL",
  "visibility": "SPACE",
  "pinned": true,
  "contentPath": "memos/Ab3kZ9q2.md",
  "tags": ["work", "work/q3"],
  "location": { "placeholder": "Office", "latitude": 52.52, "longitude": 13.405 },
  "space": { "uid": "team-notes", "title": "Team Notes" },
  "parent": "Xy7LmN01",
  "relations": [
    { "type": "REFERENCE", "memo": "Qr5TuV88" }
  ],
  "attachments": [
    {
      "uid": "att1c9d",
      "filename": "whiteboard photo.jpg",
      "type": "image/jpeg",
      "size": 482113,
      "sha256": "74a8b503a0dda2a74b87912bd7a61a9f412079a0166f07b565ee736146e67c00",
      "path": "attachments/att1c9d/whiteboard photo.jpg",
      "createTime": "2026-03-02T14:05:30Z",
      "mediaMetadata": { "width": 4032, "height": 3024 }
    },
    {
      "uid": "att77e0",
      "filename": "spec.pdf",
      "type": "application/pdf",
      "size": 120400,
      "externalLink": "https://files.example.com/spec.pdf",
      "createTime": "2026-03-02T14:06:02Z"
    }
  ],
  "reactions": [
    { "reactionType": "👍", "creator": "alice", "createTime": "2026-03-03T09:00:00Z" }
  ]
}
```

| Field | Required | Round-trips | Notes |
| --- | --- | --- | --- |
| `uid` | yes | yes | Import key. Must equal the file basename. |
| `creator` | yes | no in 1.0 | Username at export time. In a `USER` archive it equals `scope.user.username`. Present so multi-author archives are additive. |
| `createTime`, `updateTime` | yes | yes | Both are caller-settable on memo creation in the public API. |
| `state` | yes | yes | |
| `visibility` | yes | yes | `SPACE` requires a resolvable `space`; otherwise the importer falls back to `PRIVATE` with a warning. |
| `pinned` | yes | yes | |
| `contentPath` | yes | yes | Archive path of the content file. Writers use `memos/<uid>.md`. Readers follow the field, never the convention, so a minor version can move the layout. |
| `tags` | no | derived | Informational. Tags are derived from content on import; readers never write them. |
| `location` | no | yes | Mirrors the API `Location` message. `latitude` and `longitude` are WGS 84 decimal degrees. |
| `space` | no | best effort | Matched by `uid`, then by `title` among Spaces the importer is a member of, else the memo is imported Unassigned. |
| `parent` | no | yes | UID of the memo this one comments on. A record with `parent` is a comment. This is the archive's representation of the API's immutable `COMMENT` relation. |
| `relations` | no | yes | Outgoing `REFERENCE` relations only. |
| `attachments` | no | yes | Presentation order. See the attachment entry below. |
| `reactions` | no | no in 1.0 | Informational. Mirrors the API `Reaction` message with `creator` as a username. |

#### memos/{uid}.md

The exact bytes of the memo `content` field: UTF-8, no byte order mark, no added trailing newline, no front matter, no rewriting of links or attachment references. Byte identity is what lets a re-import reproduce the memo exactly, and it means a future change to how Memos parses content never invalidates an old archive: the importer stores the bytes and the current parser derives tags and properties from them, exactly as for a memo created through the API.

#### Attachment entry

| Field | Required | Notes |
| --- | --- | --- |
| `uid` | yes | Attachment UID. |
| `filename` | yes | Original filename, authoritative. The archive path may differ after the safe-name mapping. |
| `type` | yes | IANA media type, for example `image/jpeg`. |
| `size` | yes | Byte length of the content. |
| `sha256` | when `path` is present | Lowercase hexadecimal SHA-256 of the bytes. Used for integrity and to skip uploading bytes the instance already holds. |
| `path` | one of `path`, `externalLink` | Archive entry holding the bytes. Always `attachments/<uid>/<safe-filename>`. |
| `externalLink` | one of `path`, `externalLink` | External attachments carry no bytes. |
| `createTime` | yes | Informational in 1.0 because attachment creation time is output-only in the API. Preserved so importers can apply it once the API accepts it. |
| `mediaMetadata` | no | The API `MediaMetadata` message in its JSON mapping. Informational; the importer re-derives it from the bytes. |

The safe filename is `filename` after replacing each `/`, `\`, `:`, NUL, and C0 control character with `_`, trimming leading and trailing spaces and dots, prefixing `_` when the stem is a reserved Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`), and substituting `file` when the result is empty. Writers apply the mapping; readers only validate the container rules and rely on `filename`.

An attachment belongs to exactly one memo record. Attachments not linked to any memo are not exported.

### Import semantics

The importer's behavior is part of the format. An archive only survives a release if the release still does this with it.

1. Validate. `manifest.json` exists, `format` is `memos-export` or legacy `memos-archive`, the major version is supported, every entry name passes the container rules, and every record validates against its schema. Any failure aborts before anything is written.
2. Load memo records. Order so that parents precede comments, then by `createTime`.
3. Resolve each UID:
   - No memo has that UID: create it with that UID.
   - A memo with that UID exists and the importing user created it: apply the conflict policy, `SKIP` (default), `REPLACE` (update content and metadata), or `DUPLICATE` (create under a fresh UID).
   - A memo with that UID exists and someone else created it: create under a fresh UID and record the mapping.
4. Create the memo with `content`, `createTime`, `updateTime`, `state`, `visibility`, `pinned`, `location`, and the resolved `space`. The importing user is the creator regardless of `creator`.
5. Attachments. Each entry is stored through the same pipeline as an upload: the media type is re-sniffed, EXIF is stripped, and the upload size limit applies. An entry keeps its UID unless an attachment with that UID already exists; an existing unlinked attachment owned by the importer with the same bytes is bound instead of copied, and any other collision gets a fresh UID. Entries with only `externalLink` become external attachments. `mediaMetadata` is applied as client-supplied metadata would be.
6. Pinned and the `ARCHIVED` state are applied in a second write after creation, as they are for a memo created through the API, with the record's `updateTime` preserved.
7. After every record exists, apply `parent` and `relations` through the UID mapping. A target that exists neither in the archive nor on the instance, or that the importer may not read, is dropped with a warning; a memo whose parent is dropped is imported as a top-level memo. `REPLACE` never changes the parent of an existing memo because comment threading is immutable.
8. Report counts of created, updated, skipped, and failed records with reasons, plus warnings.

A record fails, and the rest continue, when its content exceeds the instance limit, an attachment entry does not match its digest or exceeds the upload limit, or a managed image reference in the content names an attachment that had to change UID. Attachments created for a record that then fails are removed again.

Because step 3 keys on the UID, running the same archive twice produces the same instance state.

### Export semantics

- The exporter writes only memos the requesting user created and attachments linked to them. No administrator bypass exists.
- The response carries `Content-Type: application/vnd.usememos.export+zip` and an RFC 6266 `Content-Disposition` with the archive filename.
- The archive filename is `memos-export-<username>-<YYYYMMDDTHHMMSSZ>.zip`, where the timestamp is the RFC 3339 basic form of `exportTime`.
- Export and import run under the same authentication as the rest of the API and count against a dedicated rate-limit scope.

### Transport

Both operations are RPCs on `UserService`, scoped to the user whose memos they touch. Only that user may call them. They pass through the same authentication, access policy, rate limiting, and error shape as every other API method and appear in the generated clients and OpenAPI document. The `archive_user` rate-limit scope counts each export and each import start.

| RPC | Route | Behavior |
| --- | --- | --- |
| `ExportMemos` | `GET /api/v1/{name=users/*}:exportMemos` | Returns `google.api.HttpBody` whose `content_type` is the archive media type and whose `data` is the archive. Over the REST gateway the response body is the raw ZIP. |
| `ImportMemos` | `POST /api/v1/{name=users/*}:importMemos` | The chunked upload protocol shared with `UploadAttachment`: the first call carries `spec.total_size` and returns an `upload_id`, later calls carry `upload_id`, `write_offset`, and `data`. A finishing call (`finish_write`) with `validate_only` validates the staged archive and returns a `MemoImportPlan`; a finishing call without it imports with `conflict_policy` and returns a `MemoImportReport`. A finished upload keeps answering with its report. Staged archives expire after thirty minutes of inactivity and do not survive a restart. |

The plan carries the manifest's export time, exporter, and generator, the archive's memo and attachment counts, how many memos are `new`, `existing` (already the caller's), or `renamed` (UID held by another account), and the reader's warnings. The report carries `created`, `updated`, `skipped`, and `failed` counts with `warnings` and `failures`, each tied to the archive memo UID where there is one. `conflict_policy` is `SKIP` (default), `REPLACE`, or `DUPLICATE`.

The web client offers both operations under Settings, Export & Import. Import is a three-step flow: the user chooses a file, the client uploads it once and finishes with `validate_only` to show the plan, and the conflict policy is asked for only when `existing` is greater than zero. Confirming sends one more finishing call on the same upload. An expired upload returns to the file picker.

### Naming and compatibility

The product actions are **Export memos** and **Import memos**. **Memos Export Format** names the file format; it is unrelated to a memo's **Archived** state. The Go package is `core/memoexport`.

Before 0.31.0 stable, this format was named Memo Archive. New exports use `format: "memos-export"`, the media type `application/vnd.usememos.export+zip`, and the filename prefix `memos-export-`. Readers continue accepting `format: "memos-archive"`; the file picker also accepts the old `application/vnd.usememos.archive+zip` media type. Import validates the manifest and does not depend on the filename or media type.

The ZIP layout and record semantics are unchanged, so `formatVersion` remains `1.0`. This is a prerelease identifier transition: older prerelease readers that only accept `memos-archive` cannot read new exports. The original prerelease fixture remains in `testdata/1.0/legacy.zip` and is tested alongside the current fixture.

### Versioning and evolution

`formatVersion` is `MAJOR.MINOR`.

- Readers accept any minor version of a major they know. A 1.0 reader accepts a 1.7 archive; it ignores members and entries it does not understand and applies the enum fallbacks above.
- Readers refuse a major version they do not know with a message naming both versions.
- Writers emit the newest version they implement.

A change is a minor bump when it only adds optional members, adds entries, adds enum values whose documented fallback is acceptable for older readers, or adds `scope.kind` values. Everything else is a major bump: removing or renaming a member, changing a member's type or meaning, changing the container rules, making an optional member required, or adding an enum value whose fallback would silently change meaning.

Within a major version a member is never removed. A member that stops being useful is marked deprecated in the schema and writers keep emitting it.

Each version has its own schema directory, `docs/design/memo-export/<MAJOR.MINOR>/`, and a golden archive under test data. CI validates every golden archive against its schema and imports every golden archive ever published, so a reader regression against an older version fails the build.

### Security invariants

- Container rules are validated, not sanitized, on read. An archive with one unsafe entry name is rejected whole.
- Content files are stored as Markdown text and never interpreted as HTML by the importer.
- The importer re-sniffs each attachment's media type on upload exactly as a normal upload does. The recorded `type` is a hint, not an instruction.
- The exporter includes only the requesting user's memos and their attachments.
- Record size, entry count, and total uncompressed size are bounded on import to defend against decompression bombs.

## Alternatives considered

- **Front matter inside each Markdown file.** Rejected. It changes the content bytes, needs escaping rules for content that itself begins with `---`, and creates a metadata dialect Memos would have to maintain forever.
- **One manifest holding every record.** Rejected. It cannot be streamed, a truncated archive loses everything, and a per-record layout is just as simple for a reader that iterates `memos/*.json`.
- **JSON Lines of protojson-encoded API messages.** Rejected. protojson output tracks the proto descriptors, so a renamed field or reserved number changes the format without anyone deciding to change it. The archive borrows the proto3 JSON conventions but owns its schema.
- **An existing container such as ENEX or TextBundle.** Rejected. Neither models visibility, pinning, Spaces, or comment threading, so Memos would carry its metadata in an extension block and inherit a parser it does not need.
- **A SQLite file.** Rejected. That is a database backup, tied to the schema.
- **Tar instead of ZIP.** Rejected. ZIP has random access through its central directory and universal desktop support.
- **A leading `mimetype` entry as in EPUB and OpenDocument.** Rejected after testing. macOS Archive Utility treats that signature as a document package and reports an unsupported format for any media type it does not know, so the archive could not be expanded with a double click.

## Deferred design

- `scope.kind` of `INSTANCE` and `SPACE`, carrying memos from many creators and adding a `users/` directory of creator records. The `creator` member on every record exists so this is additive.
- Applying `attachments[].createTime` on import once the API accepts a creation time on attachment creation.
- Importing reactions and other users' comments, which needs an administrator-scoped importer.
- Soft-deleted memos, which add a `DELETED` state value as a minor bump only if importers can safely treat it as `NORMAL` plus a warning, otherwise as a major.
- A `SELECTION` scope for a filtered subset, for example one Space or one tag, using the same record layout.
- Persisting a content digest on stored attachments so that import can find identical bytes anywhere in the account instead of only under the same UID.
- Firing memo webhooks and mention notifications for imported memos. An import currently publishes one live-refresh event and nothing else.
