---
title: "Running MCP evaluations"
status: draft
tags:
  - "mcp"
---

Reader: a contributor who changes MCP tool descriptions, the tool catalog, or the demo seed. Task: check that an LLM can still solve realistic tasks by composing the MCP tools. Step actor: the contributor, driving an MCP client or eval harness.

The `*_test.go` files in `@server/mcp/` check server plumbing (schema resolution, tool naming, annotations). The evaluation checks task success. It is the regression net for tool descriptions and discoverability: a bad `filter` description keeps unit tests green but makes several questions unanswerable.

## Prerequisites
- A checkout of the repository with the Go toolchain.
- An MCP client or eval harness that reads `<question>` / `<answer>` pairs in the mcp-builder format.
- `@server/mcp/evals/memos_eval.xml`: 15 independent, read-only questions. Each needs several tool calls and has one string-comparable answer. Questions 1–10 use the memo tools; 11–15 use the space tools and the memo `space` placement.
- Answers are pinned to the deterministic seed `@store/seed/sqlite/01__dump.sql`, which demo mode loads (`@store/migrator.go`):
  - 4 users: `steven` (instance admin), `johnny`, `bob`, `sam`.
  - 31 memos: 22 top-level and 9 comments, plus 3 `REFERENCE` relations; 35 reactions, all on top-level memos.
  - 4 spaces: `updates` (4 members), `dev`, `travel`, `reading` (3 members each). `steven` is in all four and administers `updates`; `johnny`, `bob`, and `sam` administer `dev`, `travel`, and `reading`.
  - Two top-level memos (`sam`'s ramen recipe and movie watchlist) have no space.
  - One attachment, owned by `bob` and bound to `memos/goldenhour0001`. No saved memo views and no pending invitations.
- The seed uses relative timestamps (`strftime('now','-N days')`), so questions avoid absolute dates and rely only on relative order, counts, and content, which stay stable across reseeds.

## Steps
1. Warning: do not evaluate against the public demo `demo.usememos.com`; it is one shared, mutable account.
2. Launch a throwaway demo-mode instance (SQLite, auto-seeded) on a free port:
   ```bash
   go run ./cmd/memos --demo --driver sqlite \
     --port 8099 --data "$(mktemp -d)" \
     --instance-url http://localhost:8099
   ```
3. Use the MCP endpoint `http://localhost:8099/mcp`.
4. Authenticate as `steven` with the seed's demo personal access token:
   ```
   Authorization: Bearer memos_pat_demo
   ```
5. Point the MCP client or eval harness at the endpoint.
6. Have the model answer each `<question>` in `@server/mcp/evals/memos_eval.xml`.
7. String-compare each reply against its `<answer>`.

## Verification
- Manual check of one tool call:
  ```bash
  curl -s -X POST http://localhost:8099/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'Authorization: Bearer memos_pat_demo' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memo_list_memos","arguments":{"filter":"pinned == true"}}}'
  ```
  The response is a JSON-RPC result for `memo_list_memos`, not an error.
- A complete run matches all 15 answers.

## Common Issues
- Answers no longer match after a seed edit. The seed changes from time to time (most recently to put memos into spaces), and no CI job catches drift. Re-derive every answer against a fresh instance, then update the seed summary and `@server/mcp/evals/memos_eval.xml`.
- Answers differ on the public demo. Its data has already diverged from the seed; use a fresh instance.
- A tag filter fails. The CEL `tag` field does not support `==`. Use `"work" in tags` or `tags.exists(t, t == "work")`, not `tag == "work"`.
- Comments are missing from `memo_list_memos`. It returns only top-level memos; use `memo_list_memo_comments` for comments.
- Placement filters: use `space == "spaces/dev"`, `space == null` (no space), or `space != null`.
- `space_list_spaces` returns only the caller's spaces, with `memberCount` and `currentUserRole` filled in.
- `space_list_space_invitations` needs space-administrator membership. `space_list_user_space_invitations` lists the caller's own pending invitations.
- `attachment_list_attachments` is empty for the demo account because it lists the caller's own attachments. Reach the seed attachment with `memo_list_memo_attachments` on `memos/goldenhour0001`.
- `user_list_memo_views` returns an empty set on a fresh seed. Add seed rows before writing questions that depend on them.
- A new question must be independent, read-only, need several tool calls, and have one string-comparable answer.
