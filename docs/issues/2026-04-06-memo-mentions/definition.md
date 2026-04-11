## Background & Context

Memos stores memo bodies as markdown, rebuilds derived memo metadata into `MemoPayload`, exposes user notifications through the inbox model, and renders memo content in the React client with custom markdown plugins. The requested `@someone` feature spans both top-level memos and memo comments: users need to type `@`, pick a valid person, render the mention inline, and notify the mentioned user. The current product already has adjacent primitives for this work: a backend markdown extension for `#tag`, an inbox-backed notification center, a generic editor suggestion popup, public user profiles under username-based routes, and a memo update path that already rebuilds payloads on create and edit.

External product behavior is consistent on the core interaction but different on scope. Notion supports real-time `@` suggestions inside pages, comments, and discussions, stores mention notifications in an inbox, and suppresses notification if the mentioned user cannot access the content. Confluence supports autocomplete mentions for people and teams, sends a notification on the first mention, and does not keep notifying on repeated mentions in the same page. Coda supports `@` mentions inside comment threads, treats mentions and thread participation as notification triggers, and allows broader comment-subscription settings beyond explicit mentions. These patterns suggest that the common baseline for Memos is inline autocomplete, access-aware notification, deduplication, and a clear separation between mention notifications and broader thread-subscription features.

## Issue Statement

Memos does not currently recognize `@username` tokens as structured content in memo bodies or comment bodies, does not expose any non-admin user-search endpoint that the editor can use to suggest mentionable users, does not persist or diff mention metadata during memo create or update flows, and does not have an inbox or API notification type for mentions. As a result, `@someone` currently behaves as plain text and cannot drive inline rendering, target validation, or notification delivery.

## Current State

- `server/router/api/v1/memo_service.go:32-159` creates memos by copying raw `request.Memo.Content` into `store.Memo`, enforcing length limits, and calling `memopayload.RebuildMemoPayload`; `server/router/api/v1/memo_service.go:404-510` rebuilds payload only when `content` changes during memo updates.
- `server/router/api/v1/memo_service.go:590-681` creates memo comments by internally creating another memo and only generates inbox notifications for non-private comments to the parent memo creator via `InboxMessage_MEMO_COMMENT`.
- `server/router/api/v1/memo_update_helpers.go:27-77` only dispatches webhook and SSE side effects after memo updates; there is no mention-diff side-effect hook.
- `internal/markdown/markdown.go:20-24` defines extracted markdown metadata as `Tags` plus `Property`; `internal/markdown/markdown.go:68-89` only wires the custom tag extension; `internal/markdown/markdown.go:324-386` extracts tags and properties but no mention metadata.
- `internal/markdown/extensions/tag.go:13-23` and the related tag parser/AST types are the only custom inline markdown extension path today.
- `proto/store/memo.proto:7-29` limits `MemoPayload` to `property`, `location`, and `tags`; there is no repeated mention field or structured mention metadata.
- `proto/store/inbox.proto:7-24` defines only `InboxMessage_MEMO_COMMENT`; `proto/api/v1/user_service.proto:592-679` defines only `UserNotification_MEMO_COMMENT`.
- `server/router/api/v1/user_service.go:1272-1312` lists notifications by filtering inbox rows to `InboxMessage_MEMO_COMMENT` only; `server/router/api/v1/user_service.go:1433-1524` converts only that message type into API notifications.
- `web/src/pages/Inboxes.tsx:19-114` and `web/src/components/Inbox/MemoCommentMessage.tsx` only render memo comment notifications; other notification types would currently be dropped.
- `server/router/api/v1/user_service.go:32-70` exposes `ListUsers` only to admins, and `store/user.go:59-74` plus `store/db/sqlite/user.go:88-175` support exact-match user filtering but no general search, ranking, or pagination for mention autocomplete.
- `server/router/api/v1/acl_config.go:20-27` whitelists `/memos.api.v1.UserService/SearchUsers`, but `proto/api/v1/user_service.proto:16-120` does not define a `SearchUsers` RPC and there is no server implementation.
- `web/src/components/MemoEditor/Editor/index.tsx:189-214`, `web/src/components/MemoEditor/Editor/useSuggestions.ts:28-158`, and `web/src/components/MemoEditor/Editor/TagSuggestions.tsx:10-49` provide a reusable textarea suggestion popup, but it is only instantiated for `#tag`.
- `web/src/components/MemoContent/index.tsx:53-136`, `web/src/utils/remark-plugins/remark-tag.ts:24-112`, and `web/src/components/MemoContent/Tag.tsx` parse and render `#tag` as a structured inline element; there is no `remarkMention` equivalent.
- `web/src/hooks/useUserQueries.ts:176-245` has `useListUsers()` for admin listing and `useUsersByNames()` for fetching known usernames one by one, but nothing that returns ranked candidates for an in-editor `@` query.
- `web/src/router/index.tsx:65-72` already routes public user profiles at `u/:username`, so inline mention rendering can target username-based profile URLs without inventing a new frontend route.

## Non-Goals

- Adding group mentions, team mentions, page mentions, or date mentions.
- Building a general “watch this memo/thread” subscription system beyond explicit mentions.
- Adding email, push, Slack, or webhook delivery for mentions in this issue.
- Redesigning memo visibility, access control, or per-user sharing semantics.
- Making old mentions follow username changes automatically.
- Redesigning the editor away from the current textarea-based implementation.

## Open Questions

- Which content surfaces are in scope for `@mention`? (default: top-level memos and memo comments, because both already share the same memo content pipeline)
- What mention token syntax should be recognized? (default: `@username` only, using canonical usernames rather than display names)
- Should edits trigger mention notifications after the initial create? (default: yes, but only for newly added mention targets compared with the memo’s previous mention set)
- What happens if someone types `@username` in content the target cannot access? (default: render the token as a mention in the author’s view, but do not send a notification unless the target can already access the memo/comment under existing visibility rules)
- Should mentioning yourself create an inbox item? (default: no, because self-mentions do not require attention routing)
- Should the mention candidate API be public like `GetUser`, or authenticated like the editor? (default: authenticated only, because ranked user search is a broader directory-enumeration surface than fetching a known public profile)

## Scope

**L** — The work crosses markdown parsing, memo payload extraction, memo create/update side effects, inbox and notification protos, user search APIs, three SQL drivers, React editor autocomplete, markdown rendering, and inbox UI. The repository already contains adjacent pieces for tags and comment notifications, but `@mention` requires stitching several existing subsystems together rather than extending a single isolated module.
