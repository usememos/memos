# Bookmark cover storage operations

Cached covers are creator-owned attachments referenced by memo link payloads. Multiple memos can reuse a cover. Removing a link or losing a conditional memo update can leave an unused attachment or blob. There is no automated cover garbage collector.

## Read-only inventory

Run [the SQLite inventory](../scripts/bookmark-cover-inventory.sql) against a consistent database backup opened read-only:

```bash
rtk proxy sqlite3 -readonly -header -csv /absolute/path/to/backup.db '.read scripts/bookmark-cover-inventory.sql'
```

Use SQLite's backup facility or the deployment's existing backup procedure; do not copy only the main file of an active WAL database. Output contains storage type, reference classification, count, catalog bytes and oldest timestamp. It contains no URL, attachment path, credential or memo text.

`reference-present` conservatively includes direct attachment bindings and any occurrence of an attachment UID in memo payload/content. This includes archived memos and all creators/Spaces. False-positive references are acceptable for this inventory. `reference-not-found` is an investigation candidate, never permission to delete. URL encoding, future reference types and concurrent changes prevent proving absence from a text scan. Filename prefixes are not provenance: ordinary uploads can use the same prefix.

The correlated scan is intentionally an offline operation; its worst-case work grows with candidate count multiplied by memo text size. Set a database query timeout on large snapshots. Catalog bytes may differ from actual file/object sizes, and multiple rows may reference one physical object. Compare the storage provider's existing bucket/directory usage measurements separately. Never export embedded legacy S3 credentials from attachment payloads.

For MySQL 8.4 and PostgreSQL 18, execute the equivalent read-only query on a backup/replica in a read-only transaction. Replace SQLite's candidate predicate with `a.filename LIKE 'link-cover-%'`. Replace each `instr` predicate with:

```sql
-- MySQL, binary matching for the case-sensitive attachment UID:
LOCATE(BINARY a.uid, BINARY CAST(m.payload AS CHAR)) > 0
OR LOCATE(BINARY a.uid, BINARY m.content) > 0

-- PostgreSQL:
strpos(m.payload::text, a.uid) > 0 OR strpos(m.content, a.uid) > 0
```

These engine variants require validation on their real engines before being advertised as tested operational commands. SQLite validation and any churn measurements are recorded in [release evidence](bookmarks-release-evidence.md).

## Monitoring and intervention

Record catalog candidate counts and actual storage usage daily using the deployment's existing monitoring. Alert when free space is less than twice the largest observed daily growth plus the space required for one backup, or when the provider's existing capacity alarm fires. Choose the threshold using measured headroom; an arbitrary universal byte threshold cannot protect every deployment.

When pressure rises, stop initiating bulk cover refreshes, preserve existing memos and inspect an offline inventory. Adjust available capacity or retention using established operator procedures. Do not delete `link-cover-*` objects with a filename glob. Historical blob-only orphans have no attachment row; investigate them through a provider object inventory compared against every physical reference, in a protected local environment.

## Deletion design gate

Before implementing deletion, introduce explicit managed-cover provenance for new covers and retain ambiguous legacy files. Use at least a 24-hour grace period. Inventory alone is not a deletion design.

Deletion needs a database claim/tombstone that excludes concurrent reuse and reference publication across server processes. A final reference recheck and the claim must serialize with writers, across payload references and direct attachments. Shared physical references need separate liveness checks; a per-process lock is insufficient.

Keep a durable deletion intent until storage deletion succeeds. Recovery must retry a claimed object's deletion after a crash, including the interval between physical deletion and final row cleanup. Failed deletion must not make the object eligible for reuse. Define transitions and migrate SQLite/MySQL/PostgreSQL together if a claim column/table is introduced; protobuf-only provenance still requires source regeneration.

Required tests: a candidate referenced during collection survives; a generic upload survives; a shared cover survives; repeated collection is idempotent; Local/S3 failures remain retryable; and a crash at every claim/delete/finalize boundary cannot publish a broken reference. Back up database rows and physical objects before a first destructive batch. No destructive operation is authorized by this document.
