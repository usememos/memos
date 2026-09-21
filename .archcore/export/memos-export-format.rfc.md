---
title: "Memos export format proposal"
status: draft
tags:
  - "export"
---

## Summary
Status: Proposed (2026-09-16).

Memos Export Format is a ZIP-based format that carries one user's memos and their attachments out of a Memos instance and back into an instance running the same or a later release. It is the single format for personal export, personal import, and migration between instances or database backends.

The format is built only from published standards and the public API's own vocabulary. The container is a plain ZIP file as specified by the PKWARE APPNOTE, identified by its manifest. Records are RFC 8259 JSON documents in the proto3 JSON mapping of the public API messages, so every field name, enum string, and timestamp form is one a client already sees on the wire. Memo content is stored as untouched bytes in a separate Markdown file.

Two JSON Schema documents are the normative definition of the records: @docs/design/memo-export/1.0/manifest.schema.json and @docs/design/memo-export/1.0/memo.schema.json. The proposal explains them and defines the container and the import semantics that the schemas cannot express.

## Motivation
Goals:
- A memo exported by any Memos release imports into that release and into every later release.
- Importing the same archive twice into the same instance is meant to yield the state of one import. The `DUPLICATE` conflict policy is an explicit exception: it creates a colliding memo under a fresh UID on every run. A UID held by another account also receives a fresh UID on every run.
- Moving memos between instances, database backends, or accounts on one instance needs nothing beyond export and import.
- Every field a memo owns through the public API round-trips: content, timestamps, state, visibility, pinned, location, Space placement, references, comment threading, and attachment bytes.
- The format is defined by the proposal and its schemas, not by Go types, protobuf descriptors, or database rows, so code refactors cannot change it unintentionally.
- A general-purpose ZIP tool can open the archive, and a person can read its contents without Memos.

Non-goals:
- Interoperability with other note-taking products. Memos writes and reads the archive; content files are Markdown because memo content is Markdown, not as a portability feature.
- Instance backup. Users, settings, tokens, webhooks, identity providers, and Spaces themselves are not in the archive.
- Exporting other users' memos, comments, or reactions. Version 1.0 archives are personal; the schema reserves room for multi-author archives, so an instance-level export is an additive change.
- Preserving revision history, soft-deleted memos, or share links.
- Encryption or signing.
- A scheduled or continuous writer. The archive is produced on demand.

## Detailed Design
### Standards reused
The design reuses established specifications rather than inventing encodings; each concern names the standard it follows.

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

The container is deliberately an ordinary ZIP file, so every desktop extractor opens it with a double click. The record conventions come from the API the archive mirrors, so the archive needs no vocabulary of its own.

## Drawbacks
Version 1.0 defers these capabilities:
- `scope.kind` values `INSTANCE` and `SPACE`, which carry memos from many creators and add a `users/` directory of creator records. The `creator` member on every record exists so this change is additive.
- Applying `attachments[].createTime` on import; this waits until the API accepts a creation time on attachment creation.
- Importing reactions and other users' comments, which needs an administrator-scoped importer.
- Soft-deleted memos. A `DELETED` state value is a minor bump only if importers can safely treat it as `NORMAL` plus a warning; otherwise it is a major bump.
- A `SELECTION` scope for a filtered subset, for example one Space or one tag, using the same record layout.
- A persisted content digest on stored attachments, so import can find identical bytes anywhere in the account instead of only under the same UID.
- Memo webhooks and mention notifications for imported memos. An import publishes one live-refresh event and nothing else.

## Alternatives
- **Front matter inside each Markdown file** — rejected because it changes the content bytes, needs escaping rules for content that itself begins with `---`, and creates a metadata dialect Memos would maintain forever.
- **One manifest holding every record** — rejected because it cannot be streamed and a truncated archive loses everything; a per-record layout is as simple for a reader that iterates `memos/*.json`.
- **JSON Lines of protojson-encoded API messages** — rejected because protojson output tracks the proto descriptors, so a renamed field or reserved number changes the format without anyone deciding it. The archive borrows the proto3 JSON conventions but owns its schema.
- **An existing container such as ENEX or TextBundle** — rejected because neither models visibility, pinning, Spaces, or comment threading, so Memos would carry its metadata in an extension block and inherit a parser it does not need.
- **A SQLite file** — rejected because it is a database backup, tied to the schema.
- **Tar instead of ZIP** — rejected because ZIP has random access through its central directory and universal desktop support.
- **A leading `mimetype` entry as in EPUB and OpenDocument** — rejected after testing: macOS Archive Utility recognizes that signature, sees an unknown vendor media type, reports an unsupported format, and refuses to expand the archive with a double click.
