# API Changelog

Breaking and deprecated changes to the public API in `proto/api/`, newest release first. Additive changes are not listed.

Record schema, REST route, and behavior breaks here. API compatibility is checked during review.

Add entries under a `## Unreleased` heading. After the release ships, rename it to the release tag.

```markdown
## Unreleased

### Breaking

- `MemoService.ListShortcuts`: removed. Use `UserService.ListMemoViews`.

### Deprecated

- `Memo.unassigned`: use an unset `Memo.space`. Removed in a later release.
```

## Unreleased

### Breaking

- Access tokens are now bound to the user's password hash and become invalid immediately after a password change or
  an administrator password reset. Pre-upgrade access tokens are also rejected; clients must refresh them or sign in
  again. The browser session that changes its own password can still refresh; other refresh sessions are revoked.
- Usage limits replace the instance-wide upload size and memo content caps. `StorageSetting.upload_size_limit_mb`
  and `MemoRelatedSetting.content_length_limit` are removed and old values are not migrated; `MemoRelatedSetting`
  fields are now `enable_double_click_edit = 1` and `reactions = 2`. The limits are the `USAGE_LIMITS` instance
  setting, `instance/settings/USAGE_LIMITS`, an ordered list of entries read and replaced whole through
  `GetInstanceSetting` and `UpdateInstanceSetting`; the first entry naming a user applies, the last entry applies to
  all users. The `usageLimits/{usage_limit}` resource and its five RPCs do not exist. `UserUsage` returns the limit
  set in effect as `limits` plus `limit_index`. Exceeding a limit returns `RESOURCE_EXHAUSTED` with reason
  `QUOTA_EXCEEDED` and metadata `metric`, `limit`, and `usage`.

- The API no longer carries a `v1` version marker. Every client must update its paths:
  - REST routes move from `/api/v1/...` to `/api/...` (for example `GET /api/memos`). Server-sent events move from
    `/api/v1/sse` to `/api/sse`.
  - The proto package `memos.api.v1` is now `memos.api`, so Connect and gRPC procedures move from
    `/memos.api.v1.<Service>/<Method>` to `/memos.api.<Service>/<Method>`.
  - Resource types move from `memos.api.v1/<Type>` to `memos.api/<Type>`.
  - The `domain` of `google.rpc.ErrorInfo` details is now `memos.api`.
  - For this release only, requests to `/api/v1/...` and `/memos.api.v1.*` return `410 Gone` with an `UNIMPLEMENTED`
    error that points here. The next release removes these routes.
- Field numbers in every message are renumbered from 1 in declaration order, and all `reserved` ranges are removed.
  JSON field names are unchanged; clients that use the binary protobuf encoding must regenerate from the new schema.
- Enum values are renumbered from 0 in declaration order, including `User.Role` (`ADMIN = 1`, `USER = 2`) and
  `UserSetting.Key` (`GENERAL = 1`, `WEBHOOKS = 2`, `TAGS = 3`). Clients that send numeric enum values must update them.
- Names now follow AIP conventions:
  - `MemoService`: `ListMemoAttachments`, `ListMemoRelations`, `ListMemoComments`, `CreateMemoComment`,
    `ListMemoReactions`, and `UpsertMemoReaction` take `parent` instead of `name` (REST path variable
    `{parent=memos/*}`). `ListMemoCommentsResponse.memos` is now `comments`. The nested `MemoRelation.Memo` type is
    now `MemoRelation.MemoRef`. The `MemoShare` resource singular/plural is now `memoShare`/`memoShares`.
  - `UserService.ListAllUserStats` is now `ListUserStats`. It requires a `parent`: `users/-` for all users (REST
    `GET /api/users/-/stats` instead of `GET /api/users:stats`) or `users/{user}` for one user. The response field
    `stats` is now `user_stats`.
  - `BatchGetUsersRequest.usernames` is now `names` and takes resource names (`users/{user}`), not bare usernames.
  - `PersonalAccessToken.created_at`, `expires_at`, and `last_used_at` are now `create_time`, `expire_time`, and
    `last_use_time`.
  - `LinkedIdentity.idp_name` and `extern_uid` are now `identity_provider` and `external_uid`;
    `CreateLinkedIdentityRequest.idp_name` is now `identity_provider`.
  - The `MemoView` and `UserNotification` resource singulars are now `memoView` and `userNotification`.
  - `UserStats.tag_count` is now `tag_counts`.
  - `MemoImportPlan`, `MemoImportReport`, and `MemoImportIssue` are now `ImportMemosPlan`, `ImportMemosReport`, and
    `ImportMemosIssue`. `ImportMemosPlan.memos` and `attachments` are now `memo_count` and `attachment_count`;
    `ImportMemosIssue.memo` is now `memo_uid`.
  - `UserNotification.SpaceInvitationPayload.State` is now `InvitationState`.
  - `UpdateUserSettingRequest.setting` and `ListUserSettingsResponse.settings` are now `user_setting` and
    `user_settings`; `UpdateInstanceSettingRequest.setting` and `BatchGetInstanceSettingsResponse.settings` are now
    `instance_setting` and `instance_settings`.
  - `SignInResponse.access_token_expires_at` and `RefreshTokenResponse.expires_at` are both now
    `access_token_expire_time`.
  - `SignInRequest.SSOCredentials` is now `SsoCredentials`, and its `idp_name` is now `identity_provider`.
