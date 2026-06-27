# MCP Evaluations

Task-level evaluations for the memos MCP server. Where the `*_test.go` files
verify the server *plumbing* (schema resolution, tool naming, annotations),
these check the thing that actually matters for an MCP server: **can an LLM
accomplish realistic tasks by composing the tools?** They are the regression
net for tool descriptions and discoverability — e.g. a bad `filter` description
leaves the unit tests green but makes question 3/5/9 unanswerable.

`memos_eval.xml` holds 10 question/answer pairs in the format used by the
mcp-builder skill. Each question is independent, read-only, requires multiple
tool calls, and has a single string-comparable answer.

## Why a fresh seeded instance (not the public demo)

Answers are pinned to the deterministic seed in
[`store/seed/sqlite/01__dump.sql`](../../../../store/seed/sqlite/01__dump.sql)
(10 memos — 7 top-level + 3 comments — 2 users, 12 reactions, no attachments,
no shortcuts).

The public demo (`demo.usememos.com`) signs everyone into the **same shared
`demo` account**, so visitors continually add/edit/delete memos and reactions.
Its data has already diverged from the seed — do **not** evaluate against it.

The seed uses **relative** timestamps (`strftime('now','-N days')`), so the
questions avoid absolute dates and rely only on relative ordering, counts, and
content, all of which are stable across re-seeds.

## Running an evaluation

1. Launch a throwaway demo-mode instance (SQLite, auto-seeded) on a free port:

   ```bash
   go run ./cmd/memos --demo --driver sqlite \
     --port 8099 --data "$(mktemp -d)" \
     --instance-url http://localhost:8099
   ```

2. The MCP endpoint is `http://localhost:8099/mcp`. Authenticate with the seed's
   demo personal access token:

   ```
   Authorization: Bearer memos_pat_demo
   ```

3. Point an MCP client / eval harness at that endpoint and have the model answer
   each `<question>`, then string-compare against each `<answer>`.

   Quick manual check of a single tool call:

   ```bash
   curl -s -X POST http://localhost:8099/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H 'Authorization: Bearer memos_pat_demo' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memo_list_memos","arguments":{"filter":"pinned == true"}}}'
   ```

## Notes for whoever extends this

- The CEL `tag` field does **not** support `==`; filter tags with
  `"work" in tags` (or `tags.exists(t, t == "work")`), not `tag == "work"`.
- `memo_list_memos` returns only top-level memos; comments are reached via
  `memo_list_memo_comments`.
- The seed defines no shortcuts and no attachments, so `shortcut_list_shortcuts`
  and the attachment tools return empty sets against a fresh seed. Add seed rows
  before writing questions that depend on them.
