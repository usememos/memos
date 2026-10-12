# User Usage Limits Design

Status: Draft

Date: 2026-10-11

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [API Abuse Controls Design](api-abuse-controls.md), [Configuration Provisioning Design](configuration-provisioning.md)

## Summary

Every system needs limits to stay fast and reliable. Without per-user limits, growth, mistakes, or abuse in one account can slow down or fill up a shared instance for everyone. Memos has only instance-wide limits: upload size and memo length. Users cannot see how close they are to any limit.

Usage limits keep an instance fast and reliable for everyone. This design adds them for three metrics: memo count, total storage, and the size of one file. A limit applies to every user (a default) or to one user, and a user's own limit replaces the default. With no limits, Memos behaves as before. When a limit is reached, creating a memo or starting an upload is refused with one error contract. Users see their usage in Settings. Nothing is ever hidden or deleted.

## Goals

- An admin can set default limits and per-user limits from the API and the web app.
- Memo creation and uploads are refused once a limit is reached, on every transport.
- A refused memo save keeps the draft, and its uploaded files, in the editor.
- A user can see their usage and the limits that apply to them.
- An instance with no limits runs no extra count or sum queries.

## Non-goals

- Plans, billing, or anything specific to a hosted service.
- Limits per role or group, for example all admins.
- Checking imports against limits. Import is not checked yet.
- Emails when a user nears a limit.

## Behavior

**Metrics.**

| Metric | Counts | Checked on |
| --- | --- | --- |
| `MEMOS` | Every memo row the user created: memos, comments, archived memos, and memos in Spaces | `CreateMemo` and `CreateMemoComment` |
| `STORAGE_BYTES` | The size of the user's uploads, including uploads not attached to a memo. External links do not count | `CreateAttachment`, and the start and finish of `UploadAttachment` |
| `UPLOAD_BYTES` | The size of one file. It applies only when it is lower than the instance upload limit | The same calls as storage |

**Resolution.** For each metric, the user's own limit applies if there is one, otherwise the default, otherwise the metric is unlimited. A value of 0 is unlimited, so an admin can exempt one user from a default. Admins are limited like everyone else.

**Counting.** Usage is counted live on every check. There are no stored counters that can drift. Parallel requests at a limit can go over it by the number of requests in flight. A failed count fails the request with `INTERNAL`, so a database problem cannot switch limits off.

**Lowering a limit** below a user's usage deletes nothing. New memos or uploads are refused until the user is under the limit.

## API

Five admin-only calls on `InstanceService`, on the resource `usageLimits/{usage_limit}`:

| Call | Route |
| --- | --- |
| `ListUsageLimits` | `GET /api/usageLimits`, with `filter` on `user` and `metric` |
| `GetUsageLimit` | `GET /api/usageLimits/{id}` |
| `CreateUsageLimit` | `POST /api/usageLimits` |
| `UpdateUsageLimit` | `PATCH /api/usageLimits/{id}`; only `value` can change |
| `DeleteUsageLimit` | `DELETE /api/usageLimits/{id}` |

`metric` and `user` are immutable. A second limit for the same metric and user returns `ALREADY_EXISTS`. An instance holds at most 1,000 limits.

`UserService.GetUserUsage` (`GET /api/users/{user}/usage`) returns the memo count, the stored bytes, and for each metric the limit in effect and the `usageLimits/…` name it comes from. The user and admins can call it.

**Refusal contract.** Code `RESOURCE_EXHAUSTED` (HTTP 429), message `quota exceeded`, with:

- `google.rpc.ErrorInfo`: reason `QUOTA_EXCEEDED`, domain `memos.api`, and metadata `metric`, `limit`, `usage`, and `usage_limit`. For `UPLOAD_BYTES`, `usage` is the size of the refused file.
- `google.rpc.QuotaFailure`, naming the user as the subject.

There is no `RetryInfo` and no `Retry-After` header, because waiting does not lift a usage limit.

## Storage

All limits are stored in one `system_setting` row, key `USAGE_LIMITS`, as the store message `InstanceUsageLimitsSetting`. Limits store the user ID, so renaming a user keeps their limits. There is no new table.

- **Writes** read the row, change it, and write it back only if it is unchanged since the read. A conflicting write retries up to 5 times, then returns `ABORTED`. Uniqueness and the cap are checked inside this step, so they hold across replicas.
- **Reads for checks** skip the settings cache, as `ACCESS` does, so a change applies on every replica at the next check.
- **User deletion** removes that user's limits. Writes also drop limits of users that no longer exist.
- **Settings file.** A deployment can provide `memos-instance-setting-usage-limits.json` in the store format. The write calls then return `FAILED_PRECONDITION`.

The general `UpdateInstanceSetting` call rejects the `USAGE_LIMITS` key, so the usage-limit calls are the only write path.

## Schema change

Migration `26.10/00` adds indexes on `memo.creator_id` and `attachment.creator_id`, so the count and sum queries stay fast. The schema version moves to `26.10.1`.

## Other changes

- **Storage figures exclude external links.** `GetUserStats` and the storage check no longer count `EXTERNAL` attachments, which store no bytes.
- **The web editor keeps uploaded files after a failed save.** Before, a refused create left the files as local files, so each retry uploaded them again.

## Web app

- A refused memo save keeps the draft and shows a message that names the limit. A refused upload shows a storage or file-size message.
- Settings, My Account shows usage against the limits. It is hidden when no limit applies.
- Settings, Usage limits (admin) is one table. The first row, All users, holds the defaults. Each further row is a user with their own limits, which an admin adds, edits, or removes. A user's cell shows the all-users value in gray when the user has no limit of their own. In a user's form, an empty field uses the all-users limit and 0 means no limit.
- The form warns when a file-size limit is not below the instance upload limit.

## Upgrade and rollback

- **Upgrade.** Existing instances have no limits, so behavior is unchanged apart from the external-link storage fix and the new indexes.
- **Rollback.** Restore the database from the backup taken before the upgrade, because older binaries refuse a newer schema. Remove a `memos-instance-setting-usage-limits.json` file first, because older binaries refuse to start with a settings file for a key they do not know.
