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

### Emoji tag icons

A tag whose name starts with an emoji renders that emoji as its sidebar icon
instead of the `#` prefix, in both flat and tree tag modes. Writing `#📗读书`
is all that is required; no configuration and no schema change.

Files: `web/src/lib/tag.ts`, `web/src/components/AppSidebar/TagsSection.tsx`,
`web/src/components/TagTree.tsx`, `web/src/components/AppSidebar/SidebarRow.tsx`.

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

**Authorship.** Each enabled assistant owns a provisioned bot account, named
deterministically from its id (`assistant-<digest>`). The account carries the
assistant's name and its emoji as an SVG avatar, so comments show a real author
everywhere, including third-party clients. Sign-in is impossible: the stored
password hash is deliberately not a valid bcrypt hash. Renaming an assistant
renames its account rather than creating a second one.

**Safety properties worth preserving when editing this code:**

- A review comment inherits the visibility and space of the memo it reviews, so
  it is never more visible than its parent.
- Tags the model happens to write are dropped from the comment payload, so an
  assistant cannot invent entries in the author's tag list.
- A bot never reviews its own output.
- `bot_user_id` is server-owned: it is absent from the API message and restored
  from the persisted setting on every save. The same "absence means keep"
  rule already protects provider API keys.

Files: `proto/store/instance_setting.proto`, `proto/api/v1/instance_service.proto`,
`provider/ai/chat/` (text-generation capability for OpenAI-compatible and Gemini
providers), `server/api/v1/memo_ai_assistant.go`,
`server/api/v1/memo_ai_assistant_routing.go`,
`server/api/v1/instance_ai_assistants.go`,
`web/src/components/Settings/AIAssistantSection.tsx`.

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
