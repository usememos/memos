## References

- [AIP-122: Resource names](https://google.aip.dev/122)
- [AIP-123: Resource types](https://google.aip.dev/123)
- [AIP-148: Standard fields](https://google.aip.dev/148)
- [AIP-180: Backwards compatibility](https://google.aip.dev/180)
- [Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [REST API endpoints for users - GitHub Docs](https://docs.github.com/en/enterprise-server%403.19/rest/users/users)
- [Users API - GitLab Docs](https://docs.gitlab.com/api/users/)
- [API Usage - Gitea Documentation](https://docs.gitea.com/next/development/api-usage)

## Industry Baseline

`AIP-122: Resource names` and `AIP-148: Standard fields` treat `name` as the canonical identifier that clients store and reuse, and expect request `name` and `parent` fields to accept the same resource-name vocabulary across a service. `AIP-122` also allows aliases for lookup, but requires responses to emit the canonical resource name.

`REST API endpoints for users - GitHub Docs` and `API Usage - Gitea Documentation` use username-based public user paths and nested user-scoped routes, while keeping numeric or system-assigned identifiers as separate data or alternate endpoints when a durable internal identifier is required.

`Users API - GitLab Docs` shows a mixed-input compatibility pattern on some endpoints with `id_or_username`, which keeps older callers working while allowing username-oriented public routes.

`Insecure Direct Object Reference Prevention Cheat Sheet` treats enumerable numeric identifiers as a defense-in-depth concern, but not a substitute for authorization. Replacing `users/{id}` with `users/{username}` changes discoverability characteristics, but permission checks still have to enforce access from internal user IDs.

`AIP-180: Backwards compatibility` treats changes to resource-name format and server-generated field construction as breaking. Any design that changes emitted `User.name` values inside `v1` has to preserve as much request compatibility as possible and document the remaining response-format risk explicitly.

## Research Summary

Memos already has most of the prerequisites for username-based canonical names. The schema stores a unique username, `GetUser` already resolves either ID or username, the fileserver avatar route already uses an `identifier` abstraction, and the frontend profile page already starts from `users/{username}`. No database migration is required to identify users by username at the API boundary.

The current coupling problem is concentrated in two places. First, response builders serialize `users/{id}` in many modules, including memo conversion, stats, settings, shortcuts, notifications, webhooks, and MCP JSON helpers. Second, many request handlers assume they can parse a numeric ID back out of those names for authorization and storage lookups.

Research points to a common pattern of canonical public resource names plus server-side resolution to internal IDs. In Memos, switching the canonical token from numeric ID to username can reuse the existing unique username column and existing username lookups, but `AIP-123: Resource types` and `AIP-180: Backwards compatibility` still make clear that changing accepted and emitted resource-name formats inside `v1` is a breaking API contract change. That makes this design a deliberate contract replacement rather than a compatibility layer.

## Design Goals

- All server-emitted v1 and MCP response fields that serialize user resource names under `users/{...}` use the current username token instead of the numeric database ID.
- User-scoped request fields that reference `users/{...}` accept username-based resource names only.
- Authorization, ownership checks, inbox/webhook dispatch, and other internal workflows continue to operate on `store.User.ID` after resolving the public resource name.
- List and batch endpoints avoid introducing per-item user lookups when serializing username-based names.
- No database schema, foreign-key, or storage-key redesign is required.

## Non-Goals

- Replacing internal `user.id` primary keys, foreign keys, or existing store schemas.
- Introducing a new opaque UUID-based public user identifier.
- Changing user discovery, public profile visibility, or authorization rules beyond how user resource names are parsed and emitted.
- Adding username history, redirect, or alias preservation for old usernames after a rename.
- Redesigning unrelated resource naming schemes such as memo, attachment, share, or identity-provider identifiers.
- Adding a new API version as part of this issue.

## Proposed Design

Introduce a single canonical user-name builder in the v1 API layer that serializes `users/{username}` from resolved user data, and route every public user-name emitter through it. This includes `convertUserFromStore`, memo and reaction creator fields, user stats, settings, shortcuts, webhooks, notifications, personal-access-token names, webhook payloads, avatar URLs derived from `User.name`, and the MCP JSON helpers. This satisfies the first design goal and aligns the public resource shape with `AIP-122: Resource names`.

Introduce a shared user-token resolver in `server/router/api/v1` that extracts the `users/{token}` segment, validates it as a username-form resource token, resolves the corresponding `store.User`, and then passes the resolved internal ID into permission checks and storage lookups. This replaces numeric-only parsing in helpers such as `ExtractUserIDFromName`, `ExtractUserIDAndSettingKeyFromName`, shortcut and webhook parsers, personal-access-token deletion, and notification parsing. The fileserver's current `getUserByIdentifier` behavior shows both lookup styles exist today, but the API-layer contract for this issue becomes username-only rather than dual-mode.

Keep child resource tokens unchanged and only change the user segment. For names such as `users/{user}/settings/{setting}`, `users/{user}/webhooks/{webhook}`, `users/{user}/notifications/{notification}`, `users/{user}/shortcuts/{shortcut}`, and `users/{user}/personalAccessTokens/{token}`, the parent `user` token is resolved from the username, while the child token keeps its existing format and storage mapping. This is narrower than redesigning child identifiers and keeps the issue bounded to the user-resource segment.

Use response-side user resolution strategies that match endpoint shape. Single-resource handlers can resolve one user directly and serialize the username immediately. List and batch handlers such as memo conversion, stats aggregation, notifications, and MCP list output should collect distinct user IDs first and resolve usernames once per response, reusing the store's existing user lookup path and cache where available. This keeps username-based output from turning into hidden N+1 query behavior and satisfies the performance goal without changing persistence.

Replace the public user-resource contract rather than extending it. Server-emitted `name`, `parent`, `creator`, and `sender` fields become username-based canonical output, and handlers that currently accept `users/{id}` are updated to require `users/{username}`. `AIP-180: Backwards compatibility` indicates that changing both the construction and accepted format of an existing resource name is a breaking change for clients that persist, compare, or generate old `name` values. The design therefore requires updated proto comments, API examples, handler tests, and release notes to make the new canonical form and the removed numeric form explicit.

Do not add a username alias table in this issue. If a username changes, newly serialized resource names use the current username, and previously emitted username-based names stop resolving unless they match the current username. This keeps the scope aligned with existing `UpdateUser` behavior and avoids introducing a new subsystem for historical username resolution. The alternative of adding permanent old-username aliases was rejected because it expands the problem from canonical serialization into identity-history management.

Do not solve this by adding a second public identifier field and leaving `User.name` numeric. `AIP-122: Resource names` treats `name` as the canonical resource identifier, and the GitHub issue is specifically about the public names currently emitted under `users/{id}`. Adding a second field would preserve the exposed sequential identifier in the canonical slot and fail the primary design goal. Likewise, introducing a new opaque UUID-based public identifier was rejected because the repository already has a unique username field and the issue is scoped to replacing numeric user resource names with that existing identifier.
