## Background & Context

User resources in Memos v1 are exposed through Connect/gRPC-Gateway handlers in `server/router/api/v1`, proto resource definitions in `proto/api/v1`, frontend profile flows in `web/src`, and MCP JSON helpers in `server/router/mcp`. The store schema already persists both an internal integer `id` and a unique `username` for each user. The GitHub issue reports that public user resource names such as `users/2` are still emitted across responses and nested user-scoped resources. Existing code already mixes identifier forms: `GetUser` accepts either `users/{id}` or `users/{username}`, the fileserver avatar route accepts either identifier, and the frontend profile page already enters the API through `users/{username}` before reusing the returned `user.name`.

## Issue Statement

Across the v1 API surface, canonical user resource names are currently constructed from `store.User.ID` rather than `store.User.Username`, and many handlers parse those emitted names back into integers for authorization and lookup. As a result, top-level user resources and nested user-scoped references in settings, stats, shortcuts, webhooks, notifications, memo creators, reactions, and MCP payloads expose sequential database IDs and couple downstream callers to integer-based user tokens in server-emitted names.

## Current State

- `store/user.go:26-42` defines `store.User` with both `ID int32` and `Username string`; `store/migration/sqlite/LATEST.sql:10-21` declares `username TEXT NOT NULL UNIQUE`.
- `server/router/api/v1/user_service.go:72-102` handles `GetUser` by extracting `users/{id_or_username}` and resolving either a numeric ID or a username; `server/router/api/v1/user_service.go:914-937` still serializes `User.name` as `users/{id}` and derives avatar URLs from that name.
- `server/router/api/v1/resource_name.go:67-89` has two different parsing paths: `ExtractUserIDFromName` only accepts numeric user tokens, while `extractUserIdentifierFromName` accepts either token and is currently only used by `GetUser`.
- `server/router/api/v1/user_service.go:335-369`, `server/router/api/v1/user_service.go:372-460`, `server/router/api/v1/user_service.go:463-517`, `server/router/api/v1/user_service.go:536-676`, `server/router/api/v1/user_service.go:679-911`, and `server/router/api/v1/user_service.go:1400-1488` parse numeric user segments for settings, personal access tokens, webhooks, and notifications, and emit names such as `users/%d/settings/...`, `users/%d/webhooks/...`, and `users/%d/notifications/%d`.
- `server/router/api/v1/shortcut_service.go:20-43` parses `users/{user}/shortcuts/{shortcut}` by converting the `user` segment to `int32`, and constructs shortcut names as `users/%d/shortcuts/%s`.
- `server/router/api/v1/user_service_stats.go:63-65`, `server/router/api/v1/user_service_stats.go:113`, `server/router/api/v1/user_service_stats.go:132-145`, `server/router/api/v1/user_service_stats.go:214-223` emit `users/%d/stats` and `users/%d/memos/%d`, and resolve stats requests through numeric `ExtractUserIDFromName`.
- `server/router/api/v1/memo_service_converter.go:26-37` serializes `Memo.creator` as `users/{id}`; `server/router/api/v1/reaction_service.go:154-164` serializes `Reaction.creator` as `users/{id}`; `server/router/api/v1/memo_service.go:636-643` and `server/router/api/v1/memo_service.go:815-845` parse `memo.Creator` through the numeric helper for inbox and webhook flows.
- `server/router/mcp/tools_memo.go:75-86`, `server/router/mcp/tools_attachment.go:29-37`, and `server/router/mcp/tools_reaction.go:64-71` plus `server/router/mcp/tools_reaction.go:133-138` serialize creator fields as `users/{id}` in MCP tool output.
- `server/router/fileserver/fileserver.go:153-181` and `server/router/fileserver/fileserver.go:533-539` currently resolve avatar requests by either numeric ID or username.
- `proto/api/v1/user_service.proto:22-29` and `proto/api/v1/user_service.proto:247-256` document `GetUser` accepting both `users/{id}` and `users/{username}`. The same proto file defines the `User` resource at `proto/api/v1/user_service.proto:161-178` and nested user resource formats at `proto/api/v1/user_service.proto:307-317` and `proto/api/v1/user_service.proto:361-373`; example text still uses numeric user tokens such as `users/123/settings/GENERAL`.
- `web/src/pages/UserProfile.tsx:74-86` requests `users/{username}` from the route param, and `web/src/layouts/MainLayout.tsx:37-48` stores the returned canonical `user.name` for later stats requests.

## Non-Goals

- Replacing internal `user.id` primary keys, foreign keys, or existing store schemas.
- Introducing a new opaque UUID-based public user identifier.
- Changing user discovery, public profile visibility, or authorization rules beyond how user resource names are parsed and emitted.
- Adding username history, redirect, or alias preservation for old usernames after a rename.
- Redesigning unrelated resource naming schemes such as memo, attachment, share, or identity-provider identifiers.

## Open Questions

- Which public surfaces are in scope for username-based canonical output? (default: all server-emitted v1 API and MCP payload fields that currently contain `users/{...}` resource names)
- Should legacy numeric inputs continue to resolve on user-scoped endpoints beyond `GetUser`? (default: no, accept only username-based user resource names)
- If a username changes, must previously emitted `users/{old-username}` names continue to resolve? (default: no additional alias or redirect layer; only the current username remains valid)
- Should notification, webhook, shortcut, and personal-access-token child identifiers keep their existing child token formats while only the parent user token changes? (default: yes)
- Does the issue include avatar URLs and other derived file paths that are built from `User.name`? (default: yes, because avatar URLs are emitted from the same canonical user name field)

## Scope

**L** — Current behavior spans `server/router/api/v1`, `server/router/mcp`, `server/router/fileserver`, `proto/api/v1`, frontend consumers in `web/src`, and the request parsers that turn user resource names back into internal IDs. Changing both emitted and accepted user resource names across those surfaces is a broad API contract change rather than a single local edit.
