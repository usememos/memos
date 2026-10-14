# User Usage Limits Design

Status: Draft (merged, not yet released; revised 2026-10-14)

Date: 2026-10-11, revised 2026-10-14

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [API Abuse Controls Design](api-abuse-controls.md), [Configuration Provisioning Design](configuration-provisioning.md)

## Summary

Every system needs limits to stay fast and reliable. Without per-user limits, growth, mistakes, or abuse in one account can slow down or fill up a shared instance for everyone. Before this design, Memos had only two instance-wide caps, the upload size in the storage setting and the memo content length in the memo setting, and users could not see how close they were to either.

Usage limits replace both caps with four per-user metrics: memo count, the content size of one memo, total storage, and the size of one file. The limits are one ordered list of entries. Each entry names the users it applies to, or applies to every user, and carries a value for each metric. The first entry that names a user is that user's limit set. The last entry applies to every user and is the default. A fresh instance starts with one entry, the default, that allows 8 KiB per memo and 32 MiB per file. When a limit is reached, the create, edit, or upload is refused with one error contract. Users see their usage in Settings. Nothing is ever hidden or deleted.

This revision replaces the first merged shape, which stored one resource per metric and per user with its own create, update, and delete calls. That shape could give one user a bigger limit, but it could not say which users shared a limit set, and every per-user value was a separate resource. The feature is unreleased, so the shape changes without compatibility concerns.

## Goals

- An admin can set the default limits and bigger limits for chosen users from the API and the web app, in one place.
- Memo creation, memo edits, and uploads are refused once a limit is reached, on every transport.
- A refused memo save keeps the draft, and its uploaded files, in the editor.
- A user can see their usage and the limits that apply to them.
- An instance with no count or storage limit runs no extra count or sum queries.
- A deployment can provide the whole setting as a file.

## Non-goals

- Plans, billing, or anything specific to a hosted service.
- Limits per role. Admins are limited like everyone else.
- Combining several entries for one user. The first match is the whole answer.
- Checking memo count or total storage on import. Import checks only the per-memo content size and the per-file size.
- Emails when a user nears a limit.
- Labels. A deployment with thousands of users sharing one bigger limit needs a way to say "every user with attribute X" without listing ids. That is a planned, additive extension: a `labels` field on the entry, reserved as field 2, and an admin-only label list on the user. It is not part of this revision.

## Behavior

**Metrics.**

| Metric | Counts | Checked on |
| --- | --- | --- |
| `memo_count` | Every memo row the user created: memos, comments, archived memos, and memos in Spaces | `CreateMemo` and `CreateMemoComment` |
| `memo_content_bytes` | The UTF-8 size of one memo's content | `CreateMemo`, `CreateMemoComment`, `UpdateMemo` when `content` changes, and each memo in `ImportMemos` |
| `storage_bytes` | The size of the user's uploads, including uploads not attached to a memo. External links do not count | `CreateAttachment`, and the start and finish of `UploadAttachment` |
| `upload_bytes` | The size of one file | The same calls as storage, and each attachment in `ImportMemos` |

**The list.** The setting is an ordered list of entries. An entry has `user_ids`, or `all_users`, and one optional value per metric. The list is scanned top to bottom. The first entry that lists the user, or that has `all_users` set, is the user's limit set, whole. Nothing from later entries applies. Exactly one entry has `all_users` set, and it is the last entry; it is the default.

**Values.** A set value is the limit. 0 is unlimited. An unset value is also unlimited, because an entry is a complete limit set and there is nothing to inherit from. The admin form pre-fills a new entry from the default so that leaving a field alone keeps the default's value rather than removing the limit.

**Built-in default.** When the setting does not exist, the instance behaves as if it held one entry: `all_users` with `memo_content_bytes` 8 KiB and `upload_bytes` 32 MiB, and no memo count or storage limit. The first write persists the setting. After that, the stored list is the whole truth.

**Counting.** Usage is counted live on every check. There are no stored counters that can drift. Parallel requests at a limit can go over it by the number of requests in flight. A failed count fails the request with `INTERNAL`, so a database problem cannot switch limits off. Byte-size checks on one memo or one file compare a length and run no query.

**Lowering a limit** below a user's usage deletes nothing. New memos or uploads are refused until the user is under the limit. Editing an existing memo whose content is already over the content limit is refused until the content is shortened.

## Storage

The list is stored in one `system_setting` row, key `USAGE_LIMITS`, as the store message `InstanceUsageLimitsSetting`. Entries store user IDs, so renaming a user keeps their entry. There is no new table.

```proto
message InstanceUsageLimitsSetting {
  repeated UsageLimit limits = 1;

  message UsageLimit {
    repeated int32 user_ids = 1;
    // Field 2 is reserved for labels.
    bool all_users = 3;
    optional int64 memo_count = 4;
    optional int64 memo_content_bytes = 5;
    optional int64 storage_bytes = 6;
    optional int64 upload_bytes = 7;
  }
}
```

Validation, applied to every stored list whether it comes from the API or a file:

- At most 100 entries, and at most 1,000 user IDs across all entries.
- Every entry has at least one user ID or `all_users`, never both.
- Exactly one entry has `all_users`, and it is the last entry.
- User IDs are positive and not repeated within an entry. An ID that appears in two entries is allowed; the first wins.
- Values are not negative.

Reads for checks skip the settings cache, as `ACCESS` does, so a change applies on every replica at the next check. Writes replace the whole row; there is no per-entry write. Entries naming a user that no longer exists are ignored on read and dropped on the next write. User deletion drops the user's ID from every entry; an entry left with no users and no `all_users` is dropped with it.

**Settings file.** A deployment can provide `memos-instance-setting-usage-limits.json` in the store format. The setting is then read-only through the API.

## API

The setting is an ordinary instance setting. `GetInstanceSetting` and `UpdateInstanceSetting` on `instance/settings/USAGE_LIMITS` read and replace it. There are no per-entry calls; the API shape mirrors the store shape, with `users` as `users/{user}` names in place of IDs. The admin-only `usageLimits/{usage_limit}` resource and its five calls from the first merged shape are removed.

`UserService.GetUserUsage` (`GET /api/users/{user}/usage`) returns the memo count, the stored bytes, the resolved limit set, and the entry that produced it. The user and admins can call it.

**Refusal contract.** Code `RESOURCE_EXHAUSTED` (HTTP 429), message `quota exceeded`, with:

- `google.rpc.ErrorInfo`: reason `QUOTA_EXCEEDED`, domain `memos.api`, and metadata `metric`, `limit`, and `usage`. `metric` is one of `MEMO_COUNT`, `MEMO_CONTENT_BYTES`, `STORAGE_BYTES`, `UPLOAD_BYTES`. For `MEMO_COUNT` and `STORAGE_BYTES`, `usage` is the current count or stored bytes. For `UPLOAD_BYTES`, `usage` is the size of the refused file. For `MEMO_CONTENT_BYTES`, `usage` is the size of the refused content.
- `google.rpc.QuotaFailure`, naming the user as the subject.

There is no `RetryInfo` and no `Retry-After` header, because waiting does not lift a usage limit.

## Schema change

Migration `26.10/00` adds an index on `attachment.creator_id` on every driver, and on `memo.creator_id` where it was missing, so the count and sum queries stay fast.

## Other changes

- **The instance-wide caps are removed.** `InstanceStorageSetting.upload_size_limit_mb` and `InstanceMemoRelatedSetting.content_length_limit` no longer exist in the API or the store. Old values are not migrated; the built-in default takes their place.
- **Storage figures exclude external links.** `GetUserStats` and the storage check no longer count `EXTERNAL` attachments, which store no bytes.
- **The web editor keeps uploaded files after a failed save.** Before, a refused create left the files as local files, so each retry uploaded them again.

## Web app

- A refused memo save keeps the draft and shows a message that names the limit. A refused upload shows a storage or file-size message.
- Settings, My Account shows usage against the user's limit set. It is hidden when no limit applies.
- Settings, Usage limits (admin) is the list, shown in its stored order with a position number on every row and a note that the first entry naming a user is the one that applies. Entries can be added, edited, moved up and down, and removed. The default entry is pinned last and cannot be removed. An entry's form has a user picker and four fields, pre-filled from the default. An entry that can never match, because every user it names is caught by an earlier entry, is flagged. Values are entered in KiB for content and MiB for storage and file size.

## Upgrade and rollback

- **Upgrade.** Existing instances have no `USAGE_LIMITS` row, so the built-in default applies. An instance that had raised or lowered the old instance-wide caps must set the default entry again. Apart from that, the external-link storage fix, and the new indexes, behavior is unchanged.
- **Rollback.** Restore the database from the backup taken before the upgrade, because older binaries refuse a newer schema. Remove a `memos-instance-setting-usage-limits.json` file first, because older binaries refuse to start with a settings file for a key they do not know.

## Alternatives considered

- **One resource per metric and user**, the first merged shape. Fine for a few exceptions; no way to express a shared limit set, and every value is its own resource with its own write path. Replaced by the list.
- **Named limit sets with a pointer on the user** (Joplin, Zulip, Forgejo). One extra concept for the same result; the list expresses the same thing with entry order and, later, labels.
- **A copied limit set per user** (Harbor, oCIS, Documenso). Every product that did this added a backfill job because editing the shared value did not propagate.
- **A resolver supplied by the deployment** (Nextcloud quota event, Synapse module). Hides the record outside the product, so the admin UI and the usage call cannot explain a number. Rejected before this design as well.
- **Merging several matching entries per field**, most permissive wins (Nextcloud group quota, Forgejo). Order-independent, but a rule to explain; first match needs none. An admin who wants two entries combined writes a third.
