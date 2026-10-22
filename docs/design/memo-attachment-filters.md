# Memo Attachment and Image Filters Design

Status: Draft (implemented, not yet merged)

Date: 2026-10-22

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [Multi-Spaces](multi-spaces.md) for the memo list query shape, `filter/README.md` and `filter/MAINTENANCE.md` for the filter engine.

## Summary

Memos can be filtered by facts derived from their content: `has_link`, `has_code`, `has_task_list`, `has_incomplete_tasks`, and
`has_location`. There is no way to ask for memos that carry a file, or memos that show a picture, although both are among the most
common ways people recognise a memo they are looking for.

This design adds two filter fields:

- `has_attachments`: the memo has at least one bound attachment, of any type.
- `has_image`: the memo shows an image when rendered, either because its content contains a Markdown image or because an image file is
  attached to it.

The two fields differ in where their truth lives, and the design keeps each fact in the one place that already owns it. Attachment
binding is a relation stored in `attachment.memo_id`, so both fields read it with an `EXISTS` subquery at query time. Markdown image
syntax is a content fact, so it becomes a new stored payload property, `has_inline_image`, computed by the same extractor that
computes `has_link`. Nothing about attachments is copied into the memo row, so there is nothing that can drift when an attachment is
added, moved, or deleted without the memo content changing.

Existing memos get the new property from a one-time background rebuild, gated by a payload version recorded in the instance basic
setting. The same gate serves every later change to what the extractor stores.

## Goals

- `has_attachments` and `has_image` work in every place a memo filter is accepted: the list API, saved Views, the web search box, and
  the MCP memo listing.
- Both fields support the same grammar as `has_location`: bare, negated, and compared with `true` or `false`.
- Results are correct immediately after any attachment change, with no rebuild step and no eventual consistency.
- Existing memos match after upgrade without being edited, and the upgrade does not delay serving.

## Non-goals

- Counting attachments or filtering by attachment size, name, or storage type. The attachment list API already filters attachments
  directly.
- Sorting memos by these fields. Filter fields are predicates only.
- Exposing `has_image` as a memo property on the API. Clients that render a memo already hold its attachment list and can derive it.
- Treating raw HTML `<img>` tags as images. The Markdown extractor already rejects managed attachment references in raw HTML, and the
  renderer sanitises them; content that cannot show an image does not count as having one.
- A new database index. See [Query cost](#query-cost).

## Behavior

### `has_attachments`

True when at least one row in `attachment` has `memo_id` equal to the memo's id. Comments are memos and can have attachments, so a
comment with a file matches like any other memo. An attachment that is uploaded but not yet bound to a memo matches nothing.

A managed image embedded in the content, `![alt](/file/attachments/<uid>)`, is always backed by a bound attachment: the server refuses
to save content that references a managed attachment that is not bound to the memo, and requires that attachment to have an `image/*`
type. `has_attachments` therefore already covers inline managed images, and needs no content half.

### `has_image`

True when either of the following holds:

1. The content contains a Markdown image. This covers managed attachment images and external images alike, since both render as a
   picture. Images inside code spans and code blocks do not count; the parser does not produce image nodes there.
2. At least one bound attachment has a MIME type starting with `image/`, case-insensitively. This covers the common flow of uploading
   a photo without referencing it in the text; such attachments render in the memo's attachment strip.

From the user's side there is one question, "does this memo show a picture", and one field answers it. The two sources are an
implementation detail that the filter renderer hides.

### Grammar

Both fields are booleans with the comparison rules of `has_location`:

| Expression | Meaning |
| --- | --- |
| `has_image` | memos that show an image |
| `!has_image` | memos that do not |
| `has_image == true`, `has_image != false` | same as the bare form |
| `has_image == false`, `has_image != true` | same as the negated form |
| `has_attachments && !has_image` | memos with files but no picture |

Other operators are rejected at parse time, as they are for the existing boolean fields.

## Storage

### Stored payload: `has_inline_image`

`MemoPayload.Property` in `proto/store/memo.proto` gains `bool has_inline_image = 6`. The Markdown extractor sets it when it visits an
image node, in both `ExtractAll` and `ExtractProperties`, next to `has_link`. Like the other flags it is omitted from the stored JSON
when false, so a missing key reads as false.

The flag is named for what it measures, Markdown image syntax, and not `has_image`, because the stored property is also published on
the API as `Memo.property` and every field there is documented as a fact about the content. A stored `has_image` that is false on a
memo with three uploaded photos would be misleading, and would invite someone to "simplify" the filter down to the stored flag.

`Memo.Property` in `proto/api/memo_service.proto` gains the matching `bool has_inline_image = 6`, documented as "Whether the content
contains a Markdown image." The API `Property` message stays a pure content summary. The change is additive, so
`proto/api/CHANGELOG.md` has no entry.

### Payload version

`InstanceBasicSetting` in `proto/store/instance_setting.proto` gains `int32 payload_version = 3`: the version every memo's
content-derived payload has been rebuilt to. The current version is the constant `memopayload.Version` in `core/memopayload`, next to
the rebuild that consumes it. It is `1`, for `has_inline_image`. Every later change to what the extractor stores for existing content
bumps it. The constant lives in `core/memopayload` and not in `markdown`, because the Markdown engine knows nothing about how memos are
stored or upgraded.

There is no other schema change and no migration file.

## Filter rendering

The filter engine gains one field kind, `FieldKindExists`, for a boolean derived from the presence of related rows. A field of this
kind carries a `Related` description:

- `Table`, `ForeignKey`, and `Owner`: the related table, its column that holds the owner's key, and the outer column it refers to,
  `memo.id`.
- optionally `PrefixColumn` and `Prefix`: keep only related rows whose column starts with a schema constant, ignoring case. The
  renderer rejects a prefix containing quotes or `LIKE` wildcards.

It may also carry a `JSONPath`: a payload boolean that is OR-ed with the subquery.

The renderer produces `EXISTS (SELECT 1 FROM <table> WHERE <table>.<fk> = memo.id [AND LOWER(<table>.<col>) LIKE '<prefix>%'])`, with
dialect quoting through the existing column helpers. When a `JSONPath` is set, the result is `(<json bool predicate> OR EXISTS (...))`,
using the existing `jsonBoolPredicate` helper so the payload half keeps the dialect-specific handling of a missing key or a NULL
payload. Negation and `== false` wrap the whole expression in `NOT (...)`, which is already how `has_location` is rendered. Both halves
are two-valued, so a memo with no payload and no attachments is correctly excluded or included. The SQL carries no bound arguments.

The two fields:

| Field | Related | Prefix | JSONPath |
| --- | --- | --- | --- |
| `has_attachments` | `attachment.memo_id` = `memo.id` | none | none |
| `has_image` | `attachment.memo_id` = `memo.id` | `type` starts with `image/` | `property.hasInlineImage` |

`LOWER` keeps the MIME check case-insensitive on SQLite and PostgreSQL, where `LIKE` is case-sensitive; on MySQL it is harmless.

Both subquery contexts that compile memo filters select `FROM memo`: the memo list, and the memo-relation listing that wraps the
filter in `memo_id IN (SELECT id FROM memo WHERE ...)`. The correlated `memo.id` resolves correctly in both.

### Query cost

`attachment` is indexed on `creator_id` only, so the subquery finds a memo's attachments without an index on `memo_id`. PostgreSQL and
MySQL 8 plan a correlated `EXISTS` like this as a semi-join and can hash the attachment table once; SQLite can build a transient
automatic index for the subquery. An index on `attachment(memo_id)` was considered and deferred: it would also speed up the per-page
attachment load that the memo list already performs, and should be added in its own change if list latency with these filters is
measured to need it.

## Backfill

`has_attachments` needs none, and `has_image` matches every memo with an image attachment from the first request after upgrade.

`has_inline_image` is stored, so memos saved before the upgrade lack it until their payload is rebuilt. Only memos whose only image is
an external URL are affected, because managed inline images are bound attachments and already match through the subquery. The
rebuild closes that gap.

**When it runs.** After the HTTP server starts listening, the server starts `memopayload.Runner.Backfill` in the background. It reads
the basic setting and returns at once when `payload_version` is at least `memopayload.Version`, so a normal start does no work. A fresh
install runs the pass over zero memos and records the version.

**What it writes.** For each memo, the runner extracts tags and property from the content and calls
`store.RefreshMemoDerivedPayload`. That write replaces only `$.tags` and `$.property` inside the payload JSON, through `JSON_SET` on
SQLite and MySQL and `jsonb_set` on PostgreSQL, and only `WHERE content = ?` with the content the values were computed from. On MySQL
the comparison is binary, so a case-insensitive collation cannot match an edit that only changed case. The location and every other
payload key stay as stored, and `updated_ts` does not change, so the rebuild never reorders recently updated memos. A memo that a user
edits during the pass is left alone; the edit already wrote a current payload. This guard is why the pass can run while the server
takes traffic. A plain `UpdateMemo` would write the whole payload read moments earlier, and could undo a concurrent tag or location
change.

**Coverage.** The runner first collects every memo ID in creation order, then loads and rebuilds memos in batches of 100 by ID list.
Memos created or deleted during the pass cannot shift a page boundary and skip a memo; memos created during the pass already carry the
current payload.

**Recording the version.** The version is written to the basic setting only after a pass in which every memo was written. A failed
write fails the pass after all memos have been tried, and the next start runs it again. Content the extractor cannot parse is logged
and skipped, since a retry cannot fix it and must not make every start repeat the pass. The runner clones the cached basic setting
before writing, so the schema version and secret are kept. On shutdown the server cancels the pass and waits for it before closing the
store; a canceled pass does not record the version. Rebuilding is idempotent, so a repeated or concurrent pass, for example from two
replicas, is harmless.

## Surfaces

| Surface | Change |
| --- | --- |
| `proto/store/memo.proto`, `proto/api/memo_service.proto` | `has_inline_image = 6` on both `Property` messages; the `ListMemosRequest.filter` field list names `has_attachments` and `has_image` |
| `proto/store/instance_setting.proto` | `payload_version = 3` on `InstanceBasicSetting` |
| `markdown/markdown.go` | set `HasInlineImage` on image nodes in both extraction walks |
| `server/api/memo_service_converter.go` | map the property to the API |
| `filter/schema.go`, `filter/render.go`, `filter/README.md`, `filter/MAINTENANCE.md` | `FieldKindExists`, `RelatedRows`, the two fields, and the documented grammar |
| `store/memo.go`, `store/driver.go`, `store/db/{sqlite,mysql,postgres}/memo.go` | `RefreshMemoDerivedPayload` |
| `core/memopayload/runner.go` | `Version`, `Backfill`, and the ID-first `RunOnce` |
| `server/server.go` | start the backfill after listening; cancel and wait for it on shutdown |
| `web/src/contexts/MemoFilterContext.tsx`, `web/src/components/MemoFilters.tsx`, `web/src/hooks/useMemoFilters.ts` | `property.hasAttachments` and `property.hasImage` factors with chips, following the `property.hasLocation` precedent for a non-content field |
| `web/src/pages/MemoViews.tsx` | two view examples, "With attachments" (`has_attachments`) and "Photos" (`has_image`), and both names in the field reference list |
| `web/src/locales/*.json` | `memo.filters.has-attachments` and `memo.filters.has-image` in every locale, as the parity test requires |

The MCP tools are generated from the OpenAPI document, so the updated filter description reaches the MCP memo listing with no change
there. The web chips exist for parity with the other property factors; today nothing in the UI sets those factors, and users reach
the fields through the search box and saved Views. A sidebar entry point is a separate UI decision.

## Verification

| Check | Covers |
| --- | --- |
| `go test ./markdown/... -run TestExtractInlineImage` | the flag for external, managed, reference-style, and linked images; not for code or raw HTML; both walks agree |
| `go test ./filter/...` | per-dialect goldens for the six comparison forms of both fields, rejected operators, and a SQLite behavioural test over real `memo` and `attachment` tables |
| `DRIVER=<driver> go test ./store/test/ -run TestRefreshMemoDerivedPayload` | the guarded write on SQLite, MySQL, and PostgreSQL: location and `updated_ts` kept, a case-only content edit not matched, the refreshed flag visible to `has_image` |
| `go test ./core/memopayload/...` | the version gate: rebuild once, skip when recorded, rerun when older, keep other basic setting fields, no version on cancel |
| `cd web && pnpm lint && pnpm test` | factors, chips, view examples, and locale parity |

## Alternatives considered

**Store `has_attachments` in the payload next to `has_link`.** Rejected. The payload properties are rebuilt from content, in one
place, on content writes. Attachment binding changes in at least six places that never touch content: setting a memo's attachments,
creating an attachment against a memo, deleting an attachment, deleting a memo, importing an archive, and storage cleanup. Each would
have to rewrite the memo row, and the rebuild would have to start querying the attachment table. The single column
`attachment.memo_id` already answers the question exactly; a copy of it can only be equal or wrong.

**One field, `has_image`, defined by content alone.** Rejected. The most common way a photo reaches a memo is an upload that is never
referenced in the text, and a content-only flag would miss every one of those. Users asking for "memos with a picture" mean the
rendered memo, not the Markdown source.

**Name the stored flag `has_image`.** Rejected. It is published on the API as a content property and would be false on memos that
plainly show images. `has_inline_image` says what it measures and parallels `has_link` and `has_code`.

**Expose `has_inline_image` as a filter field too.** Deferred. Users think in "has image"; offering both invites the wrong pick. It
can be added later for "external images only" without any storage change.

**Keep the payload version in the `markdown` package.** Rejected. The version describes how memos are stored and upgraded, which the
Markdown engine does not know about. It sits with the rebuild in `core/memopayload`.

**Rebuild synchronously before serving.** Rejected. It is simple and race-free, but blocks startup for as long as the pass takes, which
on a large instance can exceed a container health check. The guarded write makes a background pass safe instead.

**Rebuild with the existing `UpdateMemo`.** Rejected. It writes the whole payload as read, so a user's tag or location change made
between the read and the write would be lost.

**Add an index on `attachment(memo_id)` now.** Deferred; see [Query cost](#query-cost).

## Future work

The `FieldKindExists` kind makes further relation-backed flags one schema entry each, with no storage change:

- `has_comments`: `memo_relation` rows with `related_memo_id = memo.id AND type = 'COMMENT'`, already served by
  `idx_memo_relation_related_type_memo`. This needs an equality condition alongside the prefix one.
- `has_reactions`: `reaction.memo_id`.
- `has_video`, `has_audio`: the `has_image` subquery with a different MIME prefix and no content half.

`title`, which the payload already stores, is still not a filter field. A scalar JSON string field would allow `title.contains(...)`
and a `has_title` presence flag; it is a content fact and belongs in the payload where it already is.
