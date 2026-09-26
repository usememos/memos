# Customizations

This repository is a personal fork of [usememos/memos](https://github.com/usememos/memos).

It is **pinned**: upstream releases are no longer merged. Individual upstream
changes may be cherry-picked when they are worth the effort, but the fork is
maintained as its own product.

| | |
| --- | --- |
| Upstream baseline | [`05a2c6d`](https://github.com/usememos/memos/commit/05a2c6db7a3e926c9142a635f42f7af0f078c81d) — `chore: replace bird sprites with ink empty states` (2026-09-23) |
| Image | `ghcr.io/feihuobuzhun/memos:latest`, built by `.github/workflows/build-custom-image.yml` on every push to `main` |

## Deploying a change

1. Merge the pull request into `main`.
2. Wait for **Build Custom Image** to finish in the Actions tab.
3. On the server: back up the data volume, then `docker compose pull && docker compose up -d`.

Back up the data volume before deploying anything that touches the backend.

## Features added to the fork

### Sidebar heatmap

Upstream removed the contribution heatmap in 0.18.2. This fork restores it with
the current stack, as a mode of the existing sidebar statistics panel.

- Columns are weeks, the rightmost column is the current week, and the week
  start follows the instance setting.
- The summary line shows total memos, days recorded, current streak, and
  longest streak. A day with no memo yet does not break the current streak.
- Clicking a cell filters the memo list to that day, matching the month
  calendar it replaces. A toggle switches back to the calendar and the choice
  is remembered.
- Reuses the existing statistics data, so it adds no API calls.

Files: `web/src/components/AppSidebar/UsageHeatMap.tsx`, `StatisticsView.tsx`,
`MonthNavigator.tsx`.

### Tag icons

A tag can be given an icon — any Unicode emoji, or one of the Lucide symbols the
Space picker offers — which replaces the `#` mark in both flat and tree tag
modes. The icon is picked from the tag's own mark in the sidebar, or per rule in
Settings → Tags, and is stored on the user's tag metadata as
`UserTagMetadata.icon`, alongside the background colour and blur flag upstream
already keeps there. Keys are anchored regex patterns, so `project/.*` can mark a
whole family at once.

Marks resolve in one order everywhere: the configured icon, then a leading emoji
in the tag name (so `#📗读书`, the fork's original trick, keeps working without a
rewrite of existing memos), then the `#` mark.

Picking from the sidebar writes an exact-name rule. That rule wins the metadata
lookup over any regex rule that styled the tag before, so the regex rule's colour
and blur are copied across once; clearing the icon removes the rule again when it
carried nothing else. Tree mode is read-only here because a branch row's mark slot
already belongs to its disclosure control.

Files: `proto/store/user_setting.proto`, `proto/api/v1/user_service.proto`,
`store/user_tag_icon.go`, `server/api/v1/user_tag_icon.go`,
`server/api/v1/user_service.go` (validation),
`server/api/v1/user_service_converters.go`, `web/src/lib/tag.ts`,
`web/src/hooks/useTagIcon.ts`, `web/src/components/TagIconPicker.tsx`,
`web/src/components/CustomIconPicker.tsx` (trigger overrides),
`web/src/components/AppSidebar/SidebarRow.tsx`,
`web/src/components/AppSidebar/TagsSection.tsx`,
`web/src/components/AppSidebar/AppSidebar.tsx`, `web/src/components/TagTree.tsx`,
`web/src/components/Settings/TagsSection.tsx`.

### Inline memo references

Typing `@` in the editor opens a picker over the author's own memos; choosing one
inserts a reference where the cursor is. The reference is an ordinary Markdown
link to the memo's page — `[Memos](/memos/<uid>)` — so it survives exports, reads
correctly in other Markdown clients, and can be renamed like any other link text.
The default label is the literal `Memos` rather than the target's snippet, because
a snippet written for its own memo rarely reads correctly inside the referencing
sentence.

In the rendered memo the link becomes a chip that routes in-app instead of
opening a tab.

**The content is the single source of truth.** `REFERENCE` relations are derived
from the links in the content on every create and every content edit, which
replaces upstream's separately-stored relation list:

- Deleting the link deletes the backlink. There is no way for the two to drift.
- Derivation is lenient: a link to a missing memo, to a memo the author cannot
  read, or to the memo itself is left as a plain link rather than failing the
  write.
- `SetMemoRelations` returns `Unimplemented`, and `UpdateMemo` rejects a
  `relations` field mask. Clients link a memo by writing the link.
- The upstream import path still restores the relations recorded in an archive
  directly through the store, so an imported memo keeps its history; the
  relations are re-derived from its content the next time it is edited.

The old `+ → Link memo` dialog and the relation editor under the editor are gone,
since a reference now lives in the text. Backlinks are unchanged: the memo detail
sidebar and the related-memo rows still list what points at the memo.

Files: `markdown/memo_reference.go`, `markdown/markdown.go`
(`ExtractedData.MemoReferences`), `server/api/v1/memo_reference_helpers.go`,
`server/api/v1/memo_service.go` (UpdateMemo),
`server/api/v1/memo_relation_service.go`, `web/src/lib/memo-reference.ts`,
`web/src/components/MemoEditor/Editor/memoAutocomplete.ts`,
`web/src/components/MemoEditor/Editor/completion.ts`,
`web/src/components/MemoEditor/hooks/useMemoReferenceSearch.ts`,
`web/src/components/MemoContent/markdown/MemoReferenceLink.tsx`.

### Automatic AI review of new memos

When a memo is created, a configured assistant reviews it and posts the result
as a comment. This is the fork's largest addition and it is implemented
server-side.

**Configuration** lives in the instance AI setting, next to the providers it
calls (`InstanceAISetting.assistants`). Providers and their API keys continue
to be managed in the AI settings section; an assistant only references a
provider by id. Because the configuration is stored server-side, it applies to
every client and every device.

**Routing.** Assistants are evaluated in configured order. The first enabled
assistant whose tags match the new memo wins; a routing tag also matches its
nested children, so `book` matches `book/novel`. An enabled assistant with no
tags is the fallback for everything else. A disabled assistant is skipped
rather than swallowing its tag.

**Context.** Each assistant chooses what to send with the memo: the memo alone,
the author's most recent memos, or the author's memos sharing the tag that
routed this one. Background memos are capped by count and by total characters.

**Execution.** Reviews run on a small worker pool off the request path, so memo
creation returns immediately and the comment appears when the provider answers.
The queue is bounded; bursts beyond it are dropped rather than delaying writes.
Because the hook is on memo creation rather than in the web client, memos
created from the API or a mobile client are reviewed too.

**Authorship.** A review is stored under the reviewed memo's own author, and
which assistant wrote it is recorded in the comment's payload
(`MemoPayload.assistant`) and surfaced as the read-only `Memo.assistant` field.
The web client shows that attribution in place of the author on the comment's
header, so the author is never credited with text they did not write.

This is not a cosmetic choice. A memo's audience is defined by its creator:
only the author may comment on a private memo, and only the author may read a
private comment. An earlier version gave each assistant its own bot account,
which meant every review on a private memo was rejected on write and would
have been invisible on read even if it had been stored — and the composer
defaults to private. Keeping the author as the creator makes visibility and
authorization correct without any exception in the authorization rules.

A client that does not know about `Memo.assistant` still sees a consistent
memo, just without the attribution.

**Safety properties worth preserving when editing this code:**

- A review comment inherits the visibility and space of the memo it reviews, so
  it is never more visible than its parent.
- Tags the model happens to write are dropped from the comment payload, so an
  assistant cannot invent entries in the author's tag list.
- A memo that already carries `payload.assistant` is never reviewed, so an
  assistant cannot review its own output. A review is an ordinary memo by the
  author now, so a tagless fallback assistant would otherwise match it.
- Attribution is copied into the comment at write time, so renaming or deleting
  an assistant does not rewrite the identity an existing review was written
  under.

If an earlier build of this fork provisioned `assistant-<digest>` accounts,
they are now unused and can be removed by hand in Settings → Members. They are
deliberately not deleted automatically: deleting a user also deletes their
memos, which would destroy the reviews they already posted.

Files: `proto/store/instance_setting.proto`, `proto/api/v1/instance_service.proto`,
`proto/store/memo.proto`, `proto/api/v1/memo_service.proto`,
`provider/ai/chat/` (text-generation capability for OpenAI-compatible and Gemini
providers), `server/api/v1/memo_ai_assistant.go`,
`server/api/v1/memo_ai_assistant_routing.go`,
`server/api/v1/instance_ai_assistants.go`,
`server/api/v1/memo_service_converter.go`,
`web/src/components/Settings/AIAssistantSection.tsx`,
`web/src/components/MemoView/components/MemoHeader.tsx`.

## Development

The backend needs Go (see `go.mod`) and the frontend needs Node and pnpm.

```bash
# Backend
go build ./...
go test ./...

# Frontend
cd web && pnpm install && pnpm lint && pnpm test

# Regenerate protobuf code after editing any .proto file
cd proto && buf format -w && buf lint && buf generate
```

`buf generate` writes both the Go types under `proto/gen/` and the TypeScript
types under `web/src/types/proto/`. Commit the generated files.
