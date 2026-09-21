---
title: "Proposed export import semantics and transport"
status: draft
tags:
  - "export"
---

## Summary
Status: Proposed (2026-09-16).

This proposal details how Memos applies and produces a Memos Export Format archive: the import semantics, the export semantics, the `UserService` transport, and the security invariants. The importer's behavior is part of the format: an archive survives a release only if that release still does this with it.

## Motivation
Export and import are the only tools needed to move memos between instances, database backends, or accounts on one instance. The import steps reuse the API's own paths: attachments go through the upload pipeline, and pinned and archived state follow in a second write, as for a memo created through the API. The transport reuses the API's authentication, access policy, rate limiting, and error shape, so both operations appear in the generated clients and the OpenAPI document.

## Detailed Design
### Import semantics
1. Validate. `manifest.json` exists, `format` is `memos-export` or legacy `memos-archive`, the major version is supported, every entry name passes the container rules, and every record validates against its schema. Any failure aborts before anything is written.
2. Load memo records, ordered so that parents precede comments, then by `createTime`.
3. Resolve each UID. When no memo has that UID, the importer creates it with that UID. When the importing user created the memo holding it, the conflict policy applies: `SKIP` (default), `REPLACE` (update content and metadata), or `DUPLICATE` (create under a fresh UID). When someone else created it, the importer creates the memo under a fresh UID and records the mapping.
4. Create the memo with `content`, `createTime`, `updateTime`, `state`, `visibility`, `pinned`, `location`, and the resolved `space`. The importing user is the creator regardless of `creator`.
5. Store attachments through the same pipeline as an upload: the media type is re-sniffed, EXIF is stripped, and the upload size limit applies. An entry keeps its UID unless an attachment with that UID exists.
6. Bind, instead of copying, an existing unlinked attachment owned by the importer with the same bytes; any other attachment UID collision gets a fresh UID.
7. Turn entries with only `externalLink` into external attachments, and apply `mediaMetadata` as client-supplied metadata would be.
8. Apply pinned and the `ARCHIVED` state in a second write after creation, as for a memo created through the API, preserving the record's `updateTime`.
9. After every record exists, apply `parent` and `relations` through the UID mapping. A target that exists neither in the archive nor on the instance, or that the importer has no read access to, is dropped with a warning; a memo whose parent is dropped is imported as a top-level memo.
10. `REPLACE` never changes the parent of an existing memo, because comment threading is immutable.
11. Report counts of created, updated, skipped, and failed records with reasons, plus warnings.

A record fails, and the rest continue, when its content exceeds the instance limit, when an attachment entry does not match its digest or exceeds the upload limit, or when a managed image reference in the content names an attachment that had to change UID. Attachments created for a record that then fails are removed again.

### Export semantics
- The exporter writes only memos the requesting user created and attachments linked to them. No administrator bypass exists.
- The response carries `Content-Type: application/vnd.usememos.export+zip`.
- The archive filename is `memos-export-<username>-<YYYYMMDDTHHMMSSZ>.zip`.
- Export and import run under the same authentication as the rest of the API and count against a dedicated rate-limit scope.

### Transport
Both operations are RPCs on `UserService` (@proto/api/v1/user_service.proto), scoped to the user whose memos they touch; only that user may call them. The `archive_user` rate-limit scope (@internal/ratelimit/ratelimit.go) counts each export and each import start.

| RPC | Route | Behavior |
| --- | --- | --- |
| `ExportMemos` | `GET /api/v1/{name=users/*}:exportMemos` | Returns `google.api.HttpBody` whose `content_type` is the archive media type and whose `data` is the archive. Over the REST gateway the response body is the raw ZIP. |
| `ImportMemos` | `POST /api/v1/{name=users/*}:importMemos` | The chunked upload protocol shared with `UploadAttachment`: the first call carries `spec.total_size` and returns an `upload_id`; later calls carry `upload_id`, `write_offset`, and `data`. A finishing call (`finish_write`) with `validate_only` validates the staged archive and returns a `MemoImportPlan`; a finishing call without it imports with `conflict_policy` and returns a `MemoImportReport`. A finished upload keeps answering with its report. Staged archives expire after thirty minutes of inactivity and do not survive a restart. |

The plan carries the manifest's export time, exporter, and generator, the archive's memo and attachment counts, how many memos are `new`, `existing` (already the caller's), or `renamed` (UID held by another account), and the reader's warnings. The report carries `created`, `updated`, `skipped`, and `failed` counts with `warnings` and `failures`, each tied to the archive memo UID where there is one. `conflict_policy` is `SKIP` (default), `REPLACE`, or `DUPLICATE`.

The web client offers both operations under Settings, Export & Import. Import is a three-step flow: the user chooses a file; the client uploads it once and finishes with `validate_only` to show the plan; the conflict policy is asked for only when `existing` is greater than zero. Confirming sends one more finishing call on the same upload. An expired upload returns to the file picker.

Implementation: @core/memoexport/reader.go, @core/memoexport/writer.go, @server/api/v1/user_service_memo_export.go, @server/api/v1/user_service_memo_import.go, @server/api/v1/user_service_memo_transfer.go.

### Security invariants
- Container rules are validated, not sanitized, on read. An archive with one unsafe entry name is rejected whole.
- Content files are stored as Markdown text and never interpreted as HTML by the importer.
- The importer re-sniffs each attachment's media type on upload exactly as a normal upload does. The recorded `type` is a hint, not an instruction.
- The exporter includes only the requesting user's memos and their attachments.
- Record size, entry count, and total uncompressed size are bounded on import to defend against decompression bombs.

## Drawbacks
- Import is not idempotent for every collision: under `DUPLICATE`, and for a UID held by another account, each run creates the memo again under a fresh UID.
- A record fails when a managed image reference in its content names an attachment that had to change UID.
- `REPLACE` cannot move an existing memo to another parent, because comment threading is immutable.
- Staged archives expire after thirty minutes of inactivity and do not survive a restart; an expired upload returns to the file picker.
- Only the owning user can export or import; no administrator bypass exists.

## Alternatives
- **Sanitizing unsafe entry names on read** — rejected because path safety follows CWE-22 ("zip slip"): names are validated, never sanitized, and one unsafe name rejects the whole archive.
- **Trusting the recorded attachment `type`** — rejected because the importer re-sniffs the media type exactly as a normal upload does; the recorded type is a hint, not an instruction.
- **Letting `REPLACE` change a memo's parent** — rejected because comment threading is immutable.
