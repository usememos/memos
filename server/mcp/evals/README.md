# MCP Evaluations

Task-level evaluations for the memos MCP server. Where the `*_test.go` files
verify the server *plumbing* (schema resolution, tool naming, annotations),
these check the thing that actually matters for an MCP server: **can an LLM
accomplish realistic tasks by composing the tools?** They are the regression
net for tool descriptions and discoverability — e.g. a bad `filter` description
leaves the unit tests green but makes several questions unanswerable.

`memos_eval.xml` holds 15 question/answer pairs in the format used by the
mcp-builder skill. Each question is independent, read-only, requires multiple
tool calls, and has a single string-comparable answer. Questions 1–10 exercise
the memo tools; 11–15 exercise the space tools and the `space` placement of
memos.

## Why a fresh seeded instance (not the public demo)

Answers are pinned to the deterministic seed in
[`store/seed/sqlite/01__dump.sql`](../../../store/seed/sqlite/01__dump.sql):

- 4 users: `steven` (instance admin), `johnny`, `bob`, `sam`.
- 31 memos: 22 top-level + 9 comments, plus 3 `REFERENCE` relations.
- 35 reactions, all on top-level memos.
- 4 spaces — `updates` (4 members), `dev`, `travel`, `reading` (3 each).
  `steven` is a member of all four and administers `updates`; `johnny`, `bob`,
  and `sam` administer `dev`, `travel`, and `reading` respectively. Two
  top-level memos (`sam`'s ramen recipe and movie watchlist) are unassigned.
- One attachment, owned by `bob` and bound to `memos/goldenhour0001`.
- No saved memo views and no pending invitations.

The public demo (`demo.usememos.com`) signs everyone into the **same shared
account**, so visitors continually add/edit/delete memos, reactions, and spaces.
Its data has already diverged from the seed — do **not** evaluate against it.

The seed uses **relative** timestamps (`strftime('now','-N days')`), so the
questions avoid absolute dates and rely only on relative ordering, counts, and
content, all of which are stable across re-seeds.

The seed is edited from time to time (most recently to organize memos into
spaces). When it changes, re-derive every answer against a fresh instance and
update both this summary and `memos_eval.xml`; nothing in CI catches drift.

## Running an evaluation

The seed users have random, discarded passwords and the seed ships no access
token, so the instance needs a way to sign in as `steven`. Questions 10 and 11
depend on the caller being `steven`. Declare that user in a configuration
directory: the seed runs after the configuration is applied and attaches its
content to the declared `steven` instead of creating a second one.

1. Write a configuration that declares `steven` as an administrator with a
   password you choose:

   ```bash
   mkdir -p /tmp/memos-evals/config
   cat > /tmp/memos-evals/config/instance.json <<'EOF'
   {
     "users": [
       { "name": "users/steven", "username": "steven", "role": "ADMIN", "password": "${env:MEMOS_EVAL_PASSWORD}" }
     ]
   }
   EOF
   export MEMOS_EVAL_PASSWORD=evals-only
   ```

2. Launch a throwaway demo-mode instance (SQLite, auto-seeded) on a free port:

   ```bash
   go run -buildvcs=true ./cmd/memos --demo --driver sqlite \
     --port 8099 --data "$(mktemp -d)" \
     --config-dir /tmp/memos-evals/config \
     --instance-url http://localhost:8099
   ```

3. Sign in as `steven` and create a personal access token for the harness. The
   sign-in access token is short-lived; the personal access token is not.

   ```bash
   ACCESS_TOKEN=$(curl -s -X POST http://localhost:8099/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d "{\"passwordCredentials\":{\"username\":\"steven\",\"password\":\"$MEMOS_EVAL_PASSWORD\"}}" \
     | jq -r .accessToken)
   MEMOS_TOKEN=$(curl -s -X POST http://localhost:8099/api/users/steven/personalAccessTokens \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"description":"mcp evals"}' \
     | jq -r .token)
   ```

4. The MCP endpoint is `http://localhost:8099/mcp`. Authenticate every request
   with that token:

   ```
   Authorization: Bearer $MEMOS_TOKEN
   ```

5. Point an MCP client / eval harness at that endpoint and have the model answer
   each `<question>`, then string-compare against each `<answer>`.

   Quick manual check of a single tool call:

   ```bash
   curl -s -X POST http://localhost:8099/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H "Authorization: Bearer $MEMOS_TOKEN" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memo_list_memos","arguments":{"filter":"pinned == true"}}}'
   ```

## Notes for whoever extends this

- The CEL `tag` field does **not** support `==`; filter tags with
  `"work" in tags` (or `tags.exists(t, t == "work")`), not `tag == "work"`.
- `memo_list_memos` returns only top-level memos; comments are reached via
  `memo_list_memo_comments`.
- Placement is filtered with `space == "spaces/dev"`, `space == null`
  (unassigned), or `space != null`. `space_list_spaces` returns only spaces the
  caller is a member of, with `memberCount` and `currentUserRole` filled in.
- `space_list_space_invitations` requires space-administrator membership;
  `space_list_user_space_invitations` lists the caller's own pending invitations.
- `attachment_list_attachments` lists the caller's own attachments, so it is
  empty for the demo account; the seed's one attachment is reachable through
  `memo_list_memo_attachments` on `memos/goldenhour0001`. `user_list_memo_views`
  returns an empty set against a fresh seed. Add seed rows before writing
  questions that depend on them.
