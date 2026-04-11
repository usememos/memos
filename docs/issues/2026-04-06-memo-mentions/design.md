## References

- [Comments, mentions & reactions - Notion Help Center](https://www.notion.com/help/comments-mentions-and-reminders)
- [Notification settings - Notion Help Center](https://www.notion.com/help/notification-settings)
- [Mention a person or team - Confluence Cloud](https://support.atlassian.com/confluence-cloud/docs/mention-a-person-or-team/)
- [Comment on Coda docs - Coda Help](https://help.coda.io/hc/en-us/articles/39555917053069-Comment-on-Coda-docs)
- [Customize notifications from comments - Coda Help](https://help.coda.io/hc/en-us/articles/39555901119117-Customize-notifications-from-comments)

## Industry Baseline

`Comments, mentions & reactions - Notion Help Center` shows the most common editor-side behavior: typing `@` triggers real-time search, mentions can live inline in page bodies and comments, clicking an inbox item takes the user back to the exact context, and no notification is sent when the target cannot access the page. `Notification settings - Notion Help Center` also separates in-product inbox behavior from secondary delivery like desktop or email.

`Mention a person or team - Confluence Cloud` adds two useful guardrails for a collaborative editor: autocomplete suggestions appear directly from `@`, and notifications are intentionally deduplicated so people are notified on the first mention rather than on every repeated mention in the same page.

`Comment on Coda docs` and `Customize notifications from comments` show a narrower scope for mentions inside comments, but reinforce two patterns that matter for Memos: explicit `@` mentions are a distinct notification trigger from generic participation, and products often keep mention notifications separate from broader thread-subscription or owner-subscription rules.

Across these products, the default implementation is not “parse arbitrary display text and hope it matches a user.” The stable interaction is: search among valid workspace members, insert a canonical mention token, render it differently from plain text, and only notify when access and deduplication rules say the event is meaningful.

## Research Summary

Memos already has the right extension points to adopt that baseline without a storage redesign. The backend has a custom inline markdown extension pipeline for `#tag`, memo create and update both rebuild `MemoPayload`, and the inbox model already represents user-facing attention items. The frontend editor already has a trigger-character suggestion popup, the markdown renderer already recognizes custom inline nodes, and public user profiles are already routed by username.

The biggest mismatch is user discovery. The current `ListUsers` path is admin-only and exact-match oriented, while mention autocomplete needs a normal authenticated user search API that can return ranked candidates by username and display name. The second mismatch is notification shape: the inbox and API layers only understand memo-comment notifications today, so a mention feature cannot be expressed as a first-class notification without extending the inbox proto and inbox UI.

Research also suggests that Memos should stay narrower than Notion or Confluence. There is no existing concept of teams, group mentions, page mentions, or per-page ACLs. The codebase already treats usernames as the public user token and memo visibility as a coarse `PUBLIC/PROTECTED/PRIVATE` rule. The best fit is therefore person mentions only, keyed by canonical username, with notification rules that are access-aware and deduplicated across repeated edits.

## Design Goals

- Typing `@` in the memo editor or comment editor shows ranked, authenticated user candidates and inserts a canonical `@username` token on selection.
- The backend extracts mention targets from memo/comment content during create, update, and payload rebuild, and produces the same mention set for equivalent content across all supported databases.
- Mention notifications are created only for newly added targets, at most once per target per memo revision, and never for self-mentions or inaccessible private content.
- Memo content renders resolved mentions as interactive inline entities and degrades unresolved tokens to plain text.
- The inbox API and inbox UI expose mention notifications as a first-class type distinct from comment notifications.
- The design does not require a relational schema migration; it only extends existing proto-backed JSON payloads and server/frontend code paths.

## Non-Goals

- Adding group mentions, team mentions, page mentions, or date mentions.
- Building a generic watch/subscription system for memo activity.
- Sending mention notifications through email, push, Slack, or webhooks.
- Making mention references survive username changes automatically.
- Replacing the textarea editor with a richer block editor.
- Redesigning memo visibility or introducing user-level memo sharing.

## Proposed Design

Support only canonical `@username` mentions in this issue. The parser should recognize the same username token vocabulary that the API already accepts for public user names, instead of trying to match display names or arbitrary free text. This keeps mention authoring aligned with existing user resource naming and avoids ambiguous matches when multiple users share similar display names. Mention suggestions may show both display name and username, but the inserted source text remains `@username`.

Add a backend markdown mention extension parallel to the existing tag extension. Introduce `internal/markdown/ast.MentionNode`, `internal/markdown/parser.NewMentionParser()`, and `internal/markdown/extensions.MentionExtension`, then wire it into `internal/markdown/markdown.go` next to `TagExtension`. The mention parser should require a word boundary before `@` so email addresses and URLs do not become mentions, and it should normalize the captured token to lowercase before lookup because usernames are canonicalized that way in the API layer.

Extend `storepb.MemoPayload` with a repeated mention metadata field, for example `repeated Mention mentions`, where each item stores at least `username` and resolved `user_id`. The raw markdown remains the source of truth for author-visible text, but the payload becomes the normalized server-side mention set for diffing and notification decisions. This reuses the existing memo payload rebuild path and avoids reparsing memo bodies in multiple side-effect handlers. No SQL migration is required because memo payloads are already stored as proto-backed JSON blobs in each database driver.

Teach `memopayload.RebuildMemoPayload` to resolve mention metadata while rebuilding tags and properties. The extraction step should walk the markdown AST once, collect raw `@username` tokens, resolve them to active users via the store, deduplicate by `user_id`, and populate `memo.Payload.Mentions`. Unresolved usernames should not fail memo creation; they should simply be omitted from normalized mention metadata so the feature remains tolerant of free-typed text. This mirrors how the frontend can degrade unresolved tokens back to plain text.

Add a dedicated mention side-effect helper around memo create and update flows. On create, after the memo is persisted and the final payload is available, compute the normalized mentioned user set from `memo.Payload.Mentions` and create inbox items for allowed targets. On update, diff the previous and new normalized mention sets and only notify targets that were newly added in the latest saved revision. This follows the Confluence-style deduplication pattern and prevents repeated notifications when a memo is edited without changing its mention set. If a mention is removed and later re-added, it counts as newly added again and may generate a fresh inbox item.

Apply access and duplication rules before writing inbox rows. Self-mentions are ignored. For top-level memos, notify only when the target can already read the memo under current visibility rules. For comments, notify the mentioned user when they can read the comment context and are not already covered by the existing memo-comment notification to the parent memo owner for that same event. This keeps mention notifications meaningful and avoids sending an owner both a comment notification and a mention notification for the same comment creation unless future product requirements explicitly want both. For `PRIVATE` memos and `PRIVATE` comments, mentions remain author-visible text but do not generate inbox notifications for other users.

Extend inbox storage and API notifications with a dedicated mention type instead of overloading the existing comment type. Add `MEMO_MENTION` to `proto/store/inbox.proto` with a payload that can represent both top-level memos and comments, such as `memo_id` plus optional `related_memo_id`. Mirror that in `proto/api/v1/user_service.proto` with `UserNotification_MEMO_MENTION` and `MemoMentionPayload`. Reuse the current notification conversion pattern in `server/router/api/v1/user_service.go`: resolve memo names from stored IDs, return a first-class mention payload, and let the inbox page render a separate mention card component. This keeps the notification center composable as new activity types appear.

Add an authenticated user-search endpoint specifically for mention autocomplete. The repository already has a stale public-method placeholder for `SearchUsers`, but no proto or handler. Define `SearchUsers` in `proto/api/v1/user_service.proto`, remove it from the public ACL list, and implement it in `server/router/api/v1/user_service.go` as an authenticated RPC that accepts a short query string plus page size. Extend `store.FindUser` with search-oriented fields and implement driver-specific case-insensitive matching in SQLite, MySQL, and PostgreSQL over `username` and `nickname`, ordered by exact username match, username prefix, nickname prefix, then a stable fallback. This produces a usable editor candidate list without reusing the admin-only `ListUsers` contract.

Implement frontend mention suggestions by reusing the existing generic textarea suggestion system. Add a `MentionSuggestions` component beside `TagSuggestions`, hook it into `web/src/components/MemoEditor/Editor/index.tsx`, and back it with a debounced `useSearchUsers(query)` hook. The popup should render avatar, display name, and `@username`, while selection inserts `@username ` exactly. Because `useSuggestions` currently operates on local item arrays, it can stay generic if the mention hook owns the remote query and passes the current ranked results down as `items`.

Implement frontend mention rendering with a dedicated markdown plugin and component instead of trying to infer mentions from links or plain spans. Add `remarkMention` beside `remarkTag`, a `Mention` inline component beside `Tag`, and a mention type guard in `web/src/types/markdown.ts`. The renderer should link resolved mentions to `/u/:username`, show display name or username with avatar-based affordance when lookup data is available, and render unresolved mention text non-interactively. To avoid N-per-mention network fetches, `MemoContent` should collect mentioned usernames from content and hydrate them through the existing `useUsersByNames()` hook once per memo render tree.

Render mention notifications as their own inbox card. Reuse the existing `MemoCommentMessage` pattern, but resolve the source memo/comment and optional related memo from the `MemoMentionPayload`. The card should show who mentioned the user, in what memo or comment, a short snippet, and navigate to the relevant memo detail on click. `web/src/pages/Inboxes.tsx` should switch on both `MEMO_COMMENT` and `MEMO_MENTION` so the inbox can grow by type without silently discarding new notifications.

Do not solve username drift in this issue. If a user later changes username, existing raw markdown still contains the old `@username` text, and rebuilt payload metadata will stop resolving unless the old token still matches a live username. This is acceptable for the current scope because username-history and alias resolution are already out of scope elsewhere in the codebase. The alternative of storing opaque mention IDs in source markdown or adding a username-alias subsystem was rejected because it turns a contained collaboration feature into a broader identity migration project.
