## Task List

### Task Index

T1: Add backend mention parsing and payload extraction [M] — T2: Add mention notifications and user search APIs [L] — T3: Add frontend mention autocomplete, rendering, and inbox UI [L] — T4: Regenerate code and validate the feature [M]

### T1: Add backend mention parsing and payload extraction [M]

**Objective**: Parse `@username` tokens into structured mention metadata during memo payload rebuilds.
**Size**: M
**Files**:
- Create: `internal/markdown/ast/mention.go`
- Create: `internal/markdown/parser/mention.go`
- Create: `internal/markdown/extensions/mention.go`
- Modify: `internal/markdown/markdown.go`
- Modify: `internal/markdown/renderer/markdown_renderer.go`
- Modify: `server/runner/memopayload/runner.go`
- Modify: `server/router/api/v1/memo_service.go`
- Test: `internal/markdown/markdown_test.go`
**Implementation**:
1. Add mention AST/parser/extension parallel to the existing tag implementation.
2. Extend extracted markdown data and `MemoPayload` rebuild to collect normalized mentions and resolve them to users.
3. Update memo create/update and background payload rebuild paths to use the new mention-aware payload builder.
**Boundaries**: Do not add a relational schema migration.
**Dependencies**: None
**Expected Outcome**: Memo payloads carry normalized mention metadata rebuilt from markdown content.
**Validation**: `go test ./internal/markdown` — expected `ok`

### T2: Add mention notifications and user search APIs [L]

**Objective**: Expose mention-aware APIs and create inbox items for newly added mentions.
**Size**: L
**Files**:
- Modify: `proto/store/memo.proto`
- Modify: `proto/store/inbox.proto`
- Modify: `proto/api/v1/user_service.proto`
- Modify: `server/router/api/v1/user_service.go`
- Modify: `server/router/api/v1/connect_services.go`
- Modify: `server/router/api/v1/acl_config.go`
- Modify: `server/router/api/v1/acl_config_test.go`
- Create: `server/router/api/v1/memo_mention_helpers.go`
- Modify: `store/user.go`
- Modify: `store/db/sqlite/user.go`
- Modify: `store/db/postgres/user.go`
- Modify: `store/db/mysql/user.go`
- Test: `server/router/api/v1/test/user_notification_test.go`
- Test: `server/router/api/v1/test/user_search_test.go`
**Implementation**:
1. Extend proto contracts with `MemoPayload.mentions`, `InboxMessage.MEMO_MENTION`, `UserNotification.MEMO_MENTION`, and `SearchUsers`.
2. Implement authenticated user search over username and nickname.
3. Add mention notification side effects for memo create/update/comment flows with diffing and duplicate suppression.
4. Convert inbox rows into either comment or mention notifications and filter unknown legacy types.
**Boundaries**: Do not add email/push/webhook mention delivery.
**Dependencies**: T1
**Expected Outcome**: Mentioned users receive inbox notifications and the editor has an API to fetch mention candidates.
**Validation**: `go test ./server/router/api/v1/...` — expected `ok`

### T3: Add frontend mention autocomplete, rendering, and inbox UI [L]

**Objective**: Let users insert mentions from the editor and render/read them in the UI.
**Size**: L
**Files**:
- Create: `web/src/components/MemoEditor/Editor/MentionSuggestions.tsx`
- Modify: `web/src/components/MemoEditor/Editor/index.tsx`
- Modify: `web/src/components/MemoEditor/Editor/useSuggestions.ts`
- Modify: `web/src/hooks/useUserQueries.ts`
- Create: `web/src/utils/remark-plugins/remark-mention.ts`
- Create: `web/src/components/MemoContent/MentionContext.tsx`
- Create: `web/src/components/MemoContent/Mention.tsx`
- Modify: `web/src/components/MemoContent/index.tsx`
- Modify: `web/src/components/MemoContent/ConditionalComponent.tsx`
- Modify: `web/src/types/markdown.ts`
- Create: `web/src/components/Inbox/MemoMentionMessage.tsx`
- Modify: `web/src/pages/Inboxes.tsx`
**Implementation**:
1. Add `@` autocomplete backed by `SearchUsers`.
2. Add markdown mention parsing/rendering and hydrate mentioned users once per memo render.
3. Add a dedicated inbox card for memo mention notifications.
**Boundaries**: Do not redesign the textarea editor.
**Dependencies**: T2
**Expected Outcome**: Users can insert, see, and open mentions from memo content and inbox notifications.
**Validation**: `pnpm lint && pnpm build` — expected success

### T4: Regenerate code and validate the feature [M]

**Objective**: Regenerate generated code and verify backend/frontend behavior.
**Size**: M
**Files**:
- Modify: `proto/gen/**`
- Modify: `web/src/types/proto/**`
**Implementation**:
1. Run `buf generate` after proto changes.
2. Re-run focused Go tests and frontend lint/build.
**Boundaries**: Do not broaden into unrelated CI cleanup.
**Dependencies**: T1, T2, T3
**Expected Outcome**: Generated code matches the new APIs and validations pass.
**Validation**: `buf generate`, `go test ./internal/markdown ./server/router/api/v1/...`, `pnpm lint`, `pnpm build`

## Out-of-Scope Tasks

- Group/team mentions
- Username alias migration
- Email or push delivery for mentions
- Watch/subscription semantics beyond explicit mentions
