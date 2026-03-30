## Task List

Task Index
T1: Add username-only user resource helpers [L] — T2: Migrate user-scoped API handlers [L] — T3: Migrate memo, reaction, MCP, and avatar user references [L] — T4: Update contract docs and regression tests [L]

### T1: Add username-only user resource helpers [L]

**Objective**: Establish one v1 API mechanism for serializing `users/{username}` and resolving username-based user resource names back to internal user records, including root `GetUser` handling.
**Size**: L (multiple files, shared identifier logic used across handlers)
**Files**:
- Create: `server/router/api/v1/user_resource_name.go`
- Modify: `server/router/api/v1/resource_name.go`
- Modify: `server/router/api/v1/user_service.go`
- Test: `server/router/api/v1/test/user_resource_name_test.go`
**Implementation**:
1. In `server/router/api/v1/user_resource_name.go`: add the shared helper surface for canonical user-name construction, extracting the `users/{token}` segment, validating the username-form token, and resolving the corresponding `store.User`.
2. In `server/router/api/v1/resource_name.go`: replace `ExtractUserIDFromName()`’s numeric-only behavior with username-oriented resolution helpers or thin wrappers that delegate to the new shared module.
3. In `server/router/api/v1/user_service.go`: update `GetUser()` (~lines 72-102) and `convertUserFromStore()` (~lines 914-937) to use username-only resource names and reject legacy numeric `users/{id}` requests.
4. In `server/router/api/v1/test/user_resource_name_test.go`: add direct coverage for `GetUser users/{username}` success, canonical `User.name == users/{username}`, and rejection of `users/{id}`.
**Boundaries**: Do not migrate nested user-scoped handlers, memo/reaction emitters, MCP output, or fileserver behavior in this task.
**Dependencies**: None
**Expected Outcome**: Shared username-only helper logic exists, root user resources serialize as `users/{username}`, and root numeric user-name requests fail.
**Validation**: `go test -v ./server/router/api/v1/test -run 'TestUserResourceName'` — expected output includes `PASS` and `ok`

### T2: Migrate user-scoped API handlers [L]

**Objective**: Convert user-scoped v1 handlers and nested resource emitters to require `users/{username}` while continuing to authorize and store by resolved internal user ID.
**Size**: L (multiple handlers in one large service plus shortcut and stats code)
**Files**:
- Modify: `server/router/api/v1/user_service.go`
- Modify: `server/router/api/v1/shortcut_service.go`
- Modify: `server/router/api/v1/user_service_stats.go`
- Test: `server/router/api/v1/test/shortcut_service_test.go`
- Test: `server/router/api/v1/test/user_service_stats_test.go`
- Test: `server/router/api/v1/test/user_notification_test.go`
- Test: `server/router/api/v1/test/user_service_registration_test.go`
**Implementation**:
1. In `server/router/api/v1/user_service.go`: update settings, PAT, webhook, and notification parsing/emission paths (~lines 335-911 and ~1400-1488) to resolve `users/{username}` and emit username-based parent/child resource names.
2. In `server/router/api/v1/shortcut_service.go`: update shortcut name parsing and construction (~lines 20-43) plus handler entry points to use username parents and nested names.
3. In `server/router/api/v1/user_service_stats.go`: update stats request parsing and `UserStats.name` / `PinnedMemos` serialization (~lines 63-65, 113, 132-145, 214-223) to use usernames.
4. In the listed tests: replace numeric user-name inputs with username-based parents, assert username-based emitted names, and add numeric-request rejection coverage for representative user-scoped endpoints.
**Boundaries**: Do not change memo/reaction creator fields, MCP JSON output, or fileserver avatar routing in this task.
**Dependencies**: T1
**Expected Outcome**: User settings, notifications, shortcuts, stats, PATs, and webhooks all accept only `users/{username}` and emit only username-based user resource names.
**Validation**: `go test -v ./server/router/api/v1/test -run 'Test(ListShortcuts|GetShortcut|CreateShortcut|UpdateShortcut|DeleteShortcut|ShortcutFiltering|ShortcutCRUDComplete|GetUserStats_TagCount|ListUserNotifications|UserRegistration)'` — expected output includes `PASS` and `ok`

### T3: Migrate memo, reaction, MCP, and avatar user references [L]

**Objective**: Remove numeric user resource names from memo/reaction-related API responses, dependent webhook/inbox flows, MCP JSON output, and avatar URLs/routing.
**Size**: L (cross-package serialization and lookup changes, including response-side user resolution)
**Files**:
- Modify: `server/router/api/v1/memo_service_converter.go`
- Modify: `server/router/api/v1/memo_service.go`
- Modify: `server/router/api/v1/reaction_service.go`
- Modify: `server/router/mcp/tools_memo.go`
- Modify: `server/router/mcp/tools_attachment.go`
- Modify: `server/router/mcp/tools_reaction.go`
- Modify: `server/router/fileserver/fileserver.go`
- Test: `server/router/api/v1/test/memo_service_test.go`
- Test: `server/router/api/v1/test/reaction_service_test.go`
**Implementation**:
1. In `server/router/api/v1/memo_service_converter.go`: update `convertMemoFromStore()` (~lines 16-73) to serialize `Memo.creator` from resolved usernames rather than numeric IDs, using response-side batching or shared lookup helpers so list responses do not regress into hidden per-item lookups.
2. In `server/router/api/v1/reaction_service.go`: update `convertReactionFromStore()` (~lines 154-164) to emit username-based creators.
3. In `server/router/api/v1/memo_service.go`: update memo comment, webhook dispatch, and webhook payload helpers (~lines 636-643 and 815-845) to resolve username-based memo creators before using internal IDs.
4. In `server/router/mcp/tools_memo.go`, `server/router/mcp/tools_attachment.go`, and `server/router/mcp/tools_reaction.go`: replace `users/%d` creator serialization with username-based values.
5. In `server/router/fileserver/fileserver.go`: change avatar lookup to accept username identifiers only and ensure avatar URLs derived from `User.name` continue to resolve under `users/{username}`.
6. In the listed tests: update creator assertions to `users/{username}` and add representative rejection coverage where numeric user names previously flowed through memo/reaction-related paths.
**Boundaries**: Do not update proto comments, README examples, or frontend comments in this task.
**Dependencies**: T1
**Expected Outcome**: Memo/reaction creators, webhook payload creators, MCP creator fields, and avatar-derived user paths no longer expose numeric user IDs.
**Validation**: `go test ./server/router/api/v1/... ./server/router/mcp/... ./server/router/fileserver/...` — expected output includes `ok` for all touched packages

### T4: Update contract docs and regression tests [L]

**Objective**: Align public contract comments/examples and the final regression suite with the username-only user resource-name contract.
**Size**: L (multiple contract/documentation files plus end-to-end regression coverage)
**Files**:
- Modify: `proto/api/v1/user_service.proto`
- Modify: `proto/api/v1/shortcut_service.proto`
- Modify: `web/src/layouts/MainLayout.tsx`
- Modify: `web/src/components/MemoExplorer/ShortcutsSection.tsx`
- Modify: `server/router/fileserver/README.md`
- Modify: `server/router/api/v1/test/user_resource_name_test.go`
- Modify: `server/router/api/v1/test/shortcut_service_test.go`
- Modify: `server/router/api/v1/test/user_service_stats_test.go`
- Modify: `server/router/api/v1/test/user_notification_test.go`
- Modify: `server/router/api/v1/test/memo_service_test.go`
- Modify: `server/router/api/v1/test/reaction_service_test.go`
- Modify: `server/router/api/v1/test/user_service_registration_test.go`
**Implementation**:
1. In `proto/api/v1/user_service.proto` and `proto/api/v1/shortcut_service.proto`: rewrite resource-name comments and examples so they document username-only user resource names and remove `users/{id}` examples.
2. In `web/src/layouts/MainLayout.tsx` and `web/src/components/MemoExplorer/ShortcutsSection.tsx`: update inline comments/examples that still describe numeric user resource names.
3. In `server/router/fileserver/README.md`: replace numeric avatar examples with username-based examples.
4. In the listed test files: finish any remaining request/response assertions so the suite consistently encodes the username-only contract and explicitly rejects numeric user resource names where that contract is externally visible.
**Boundaries**: Do not add schema migrations, generated proto output refreshes, or username-history behavior.
**Dependencies**: T2, T3
**Expected Outcome**: Source comments, examples, and regression tests all describe and enforce a username-only `users/{username}` public contract.
**Validation**: `go test -v ./server/router/api/v1/test/...` — expected output includes `PASS` and `ok`

## Out-of-Scope Tasks

- Database schema or migration changes for the `user` table or foreign keys.
- Username history, alias, redirect, or backward-compatibility layers.
- A new opaque public user identifier or a new API version.
- Opportunistic refactors outside the files listed above.
- Generated code refreshes (`buf generate`) unless a later approved plan revision explicitly requires schema changes.
