# Memos Export Format

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md), [`.archcore/export/export-format-details.rfc.md`](../../.archcore/export/export-format-details.rfc.md), and [`.archcore/export/export-import-semantics.rfc.md`](../../.archcore/export/export-import-semantics.rfc.md).

## Summary

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).

## Goals

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).

- Importing the same archive twice into the same instance yields the same state as importing it once.

## Non-goals

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).

## Research

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).

## Proposed design

> Moved to [`.archcore/export/export-format-details.rfc.md`](../../.archcore/export/export-format-details.rfc.md) and [`.archcore/export/export-import-semantics.rfc.md`](../../.archcore/export/export-import-semantics.rfc.md).

### Import semantics

> Moved to [`.archcore/export/export-import-semantics.rfc.md`](../../.archcore/export/export-import-semantics.rfc.md).

Because step 3 keys on the UID, running the same archive twice produces the same instance state.

### Export semantics

> Moved to [`.archcore/export/export-import-semantics.rfc.md`](../../.archcore/export/export-import-semantics.rfc.md).

- The response carries `Content-Type: application/vnd.usememos.export+zip` and an RFC 6266 `Content-Disposition` with the archive filename.
- The archive filename is `memos-export-<username>-<YYYYMMDDTHHMMSSZ>.zip`, where the timestamp is the RFC 3339 basic form of `exportTime`.

### Versioning and evolution

> Moved to [`.archcore/export/export-format-details.rfc.md`](../../.archcore/export/export-format-details.rfc.md).

Each version has its own schema directory, `docs/design/memo-export/<MAJOR.MINOR>/`, and a golden archive under test data. CI validates every golden archive against its schema and imports every golden archive ever published, so a reader regression against an older version fails the build.

## Alternatives considered

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).

## Deferred design

> Moved to [`.archcore/export/memos-export-format.rfc.md`](../../.archcore/export/memos-export-format.rfc.md).
