---
planId: "8dc103a7-d845-483f-b89b-800768e7d419"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
affectedPaths:
  - "server/router/api/v1/memo_markdown.go"
  - "server/router/api/v1/memo_markdown_test.go"
  - "server/server.go"
tickets:
  - url: "https://github.com/usememos/memos/issues/6229"
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
devServerCommand: "go run ./cmd/memos --port 8081"
devServerUrl: "http://localhost:8081"
devServerHmr: false
createdAt: "2026-08-26T10:19:24-04:00"
status: "in_progress"
origin: "internal"
userVerifiedAt: null
routingIntent: "PLANNED_CHANGE"
sessionName: "issue 6229 implementation"
targetBranch: "main"
---

# Serve Memo Markdown from Memo URLs

## Context

GitHub issue [#6229](https://github.com/usememos/memos/issues/6229) asks Memos to return a memo's Markdown source without the current open, select, and copy workflow. A caller must be able to append `.md` to a memo URL or explicitly request `text/markdown` from the normal memo URL.

Today, `GET /memos/{memo UID}` falls through to the React single-page application. The page then calls the v1 Memo API. The server has no native Markdown representation for that browser URL.

The agreed access scope is permission parity with normal memo reads. Anonymous callers can read eligible public memos. Authenticated callers can read the protected, private, archived, or Space memos that the existing memo access policy permits. Memo share URLs and share tokens are not part of this change.

The repository is a fork with `origin` set to `gandazgul/memos`. After verification, the implementation is expected to be pushed on a feature branch and opened as a pull request to `usememos/memos:main` that closes issue #6229.

## Objective

Add a native HTTP Markdown representation for memo detail URLs:

- `GET /memos/{memo UID}.md` returns the exact Memo Markdown.
- `GET /memos/{memo UID}` returns the exact Memo Markdown when `Accept` explicitly permits `text/markdown` with positive quality.
- Other `GET /memos/{memo UID}` requests continue to return the React application.
- The representation uses the existing authentication and memo read policy. It does not create a second access model or grant access through memo share tokens.

## Approach

Keep the adapter in `server/router/api/v1`, next to the service that already owns memo reads and their authorization rules. Register one native Echo route after the frontend fallback middleware is installed and before the generated gateways are registered.

```text
GET /memos/{uid}[.md]
  -> Markdown requested by suffix or explicit Accept header?
       no  -> return 404 to existing SPA fallback -> index.html
       yes -> load memo by UID
            -> resolve anonymous access first
            -> if needed, authenticate bearer/PAT/refresh-cookie caller
            -> access.ResolveMemoReadFacts + CheckMemoReadContext
            -> exact memo.Content as text/markdown
```

The handler must use `access.ResolveMemoReadFacts`, `MemoReadFacts.WithViewer`, and `access.CheckMemoReadContext`, or a package-local service helper built on those owners. It must not copy the audience rules into the handler. Evaluate anonymous access before parsing credentials, as `server/router/fileserver/fileserver.go` does, so an expired browser cookie cannot break an otherwise valid public read.

For `Accept`, parse comma-separated media ranges and their parameters. `text/markdown` is selected only when its quality is greater than zero. A wildcard such as `*/*`, a malformed range, or `text/markdown;q=0` does not select Markdown. A terminal `.md` suffix always selects Markdown, independent of `Accept`.

Successful Markdown responses are inline and use `Content-Type: text/markdown; charset=utf-8`, `X-Content-Type-Options: nosniff`, `Vary: Accept`, and the existing API no-store headers. Do not add `Content-Disposition`; the issue asks for a directly consumable representation, not a forced download.

The set-aside option was a new top-level Markdown router. It would make transport ownership less clear and duplicate sensitive private API access behavior.

## Expected Change Surface

The boundaries this change is expected to touch. This list is guidance, not an allowlist: verify the real footprint
during implementation and change whatever the Implementation Steps need, including files not named here. Stop and report
only when discovery changes approved intent — the change reaches another subsystem, public behavior or architecture
shifts, migration or compatibility risk grows, or the Verification Plan no longer proves the objective.

- `server/router/api/v1/memo_markdown.go` — own HTTP negotiation, route registration, memo lookup, request authentication, access-decision-to-HTTP mapping, and the Markdown response.
- `server/router/api/v1/memo_markdown_test.go` — prove both request forms, exact source output, permission parity, share-token exclusion, safe headers, and React fallback preservation through real Echo routes.
- `server/server.go` — register the memo Markdown route on the constructed v1 API service before the generated gateway routes.
- `server/router/api/v1/memo_access.go` — reuse its existing memo access helpers; change it only if a small package-local extraction is necessary to avoid duplicate policy resolution.
- `server/router/frontend/frontend.go` — preserve its current SPA fallback contract; change it only if implementation proves that the negotiated route cannot coexist with the fallback without a focused adjustment.

`docs/domain-language.md` already defines **Memo Markdown** as the memo's Markdown source text. This change makes that existing term available through another representation and does not redefine the term, so no glossary update is expected.

## Reuse Opportunities

- `server/access/memo_resolve.go` — reuse `ResolveMemoReadFacts` and `MemoReadFacts.WithViewer` to resolve creator, Space, and membership facts.
- `server/access/memo.go` — reuse `CheckMemoReadContext`; it remains the source of truth for memo audience and lifecycle access.
- `server/auth/authenticator.go` — reuse `Authenticator.AuthenticateToUser` for bearer access tokens, Personal Access Tokens, and refresh-token browser sessions.
- `server/router/fileserver/fileserver.go` — follow `checkAttachmentPermission` ordering: authorize an anonymous public read before credential parsing, then resolve the viewer and evaluate the same facts.
- `server/router/api/v1/v1.go` — reuse `setAPIResponseNoStoreHeaders` for revocation-safe caching behavior.
- `server/router/frontend/frontend.go` — rely on `spaFallbackMiddleware` to serve `index.html` after a non-Markdown memo request returns Echo 404.
- `store/memo.go` — use `Store.GetMemo` with `store.FindMemo{UID: ...}` and return `Memo.Content` without rendering or conversion.

## Implementation Steps

- [ ] `APIV1Service` registers a native `GET /memos/:uid` handler that selects Markdown for a terminal `.md` suffix or an explicit acceptable `text/markdown` media range, while wildcard, malformed, and zero-quality ranges do not select Markdown.
- [ ] A non-Markdown `GET /memos/{memo UID}` returns control through the existing not-found path so `spaFallbackMiddleware` still serves the React `index.html`; it never returns memo source from a default browser or `*/*` request.
- [ ] A selected Markdown request loads exactly one memo by its suffix-free Memo UID and returns its unrendered `Memo.Content` byte-for-byte with HTTP 200, including empty content and non-ASCII content.
- [ ] Markdown reads use `access.ResolveMemoReadFacts`, viewer resolution, and `access.CheckMemoReadContext` as the authorization owner. Public reads are evaluated before credentials; protected, private, archived-owner, and Space reads require the same viewer facts as normal memo reads.
- [ ] The HTTP adapter maps missing or policy-hidden memos to 404, missing required authentication to 401, authenticated permission denial to 403, and store or access-resolution failures to 500 without exposing internal error details.
- [ ] A valid memo share token does not authorize either Markdown request form. No route is added for `/memos/shares/:token`, and the Markdown handler does not load or evaluate memo shares.
- [ ] Every successful Markdown response has `Content-Type: text/markdown; charset=utf-8`, `X-Content-Type-Options: nosniff`, `Vary: Accept`, and `Cache-Control: no-cache, no-store, must-revalidate` with the related `Pragma` and `Expires` headers; it has no forced-download `Content-Disposition` header.
- [ ] Behavioral tests exercise the registered Echo route and fail if the handler is a placeholder, a pass-through to the SPA, a rendered-HTML response, or a local audience approximation. They cover both request forms, exact Markdown content, normal HTML fallback, explicit Accept quality handling, a public memo allowed anonymously only in public instance mode, public access with a stale cookie, protected authenticated access, private owner success and non-owner denial, Space active-member success and non-member denial, archived-owner success and non-owner hiding, an unknown UID, and share-token exclusion.
- [ ] `server/server.go` registers the completed route on the same `APIV1Service` used by the generated gateways, after frontend middleware installation and before gateway registration, without changing existing API or frontend route paths.
- [ ] The finished change is committed on a feature branch, pushed to `gandazgul/memos`, and opened as a pull request against `usememos/memos:main`; the PR title describes direct Memo Markdown access, its body summarizes behavior and verification, and `Closes usememos/memos#6229` links the implementation to the upstream issue.

## Approval Confirmation

No Work Record is superseded by this Plan.

## Verification Plan

- Automated behavior: run `go test -v -race ./server/router/api/v1/...`. The new route tests must assert the exact Markdown body from real stored memos for both `.md` and `Accept` forms. A named permission-parity table must also prove that a public memo is denied anonymously in private instance mode, an active Space member succeeds, a Space non-member fails, a private owner succeeds, and a private non-owner fails. These assertions fail if the route returns the SPA, rendered HTML, an empty stub, unconditional pass-through content, or a local visibility switch that omits instance or Space facts.
- Automated server regression: run `go test -v -race ./server/...` to protect API authentication, shared access policy, frontend fallback, and route registration behavior.
- Automated repository checks: run `golangci-lint run` and `go test ./...` before opening the pull request.
- Manual public flow: start `go run ./cmd/memos --port 8081`, create an eligible public memo with distinctive Markdown such as a heading and fenced code block, then run `curl -i http://localhost:8081/memos/{uid}.md` and `curl -i -H 'Accept: text/markdown' http://localhost:8081/memos/{uid}`. Both responses must be HTTP 200 and their bodies must exactly match the stored source, not rendered HTML.
- Manual negotiation flow: open `http://localhost:8081/memos/{uid}` in a browser or run `curl -i -H 'Accept: text/html,*/*' ...`. The React application must load as before. `curl -i -H 'Accept: text/markdown;q=0,*/*' ...` must also use the HTML path.
- Manual protected flow: use `curl -i -H 'Authorization: Bearer {PAT}' -H 'Accept: text/markdown' http://localhost:8081/memos/{uid}` for a protected memo and for a Space memo where the PAT owner is an active member. Both must return 200. Repeat without credentials and expect 401; repeat as an authenticated private-memo non-owner or Space non-member and expect 403. In private instance mode, an anonymous public-memo request must return 401. An archived memo requested by a non-owner must remain hidden with 404.
- Manual header check: confirm Markdown responses include the exact Markdown content type, no-store headers, `Vary: Accept`, and `X-Content-Type-Options: nosniff`, with no `Content-Disposition: attachment`.
- Pull request check: use `gh pr view --repo usememos/memos` after creation to confirm base `main`, head repository/branch, issue-closing reference, and the commands reported in the PR body.

## Edge Cases & Considerations

- Content negotiation must not treat the browser's common `*/*` range as a Markdown request. Otherwise all memo pages become raw text.
- Only a terminal, case-sensitive `.md` suffix is removed from the route parameter. The base UID is looked up normally; malformed and unknown values return 404 without revealing storage details.
- The response is exact Memo Markdown. It does not expand attachments, append metadata, render Markdown, include comments, or rewrite links.
- Anonymous authorization runs before request credential parsing. An expired refresh cookie must not turn a public memo into a server error.
- Permission parity includes the memo's own audience, lifecycle, creator validity, Space validity, and active Space membership. Relations and comments do not transfer access.
- No database, Protocol Buffer, generated output, frontend component, or public API access-control-list change is expected.
- No upstream remote is configured. The pull request must use an explicit upstream repository, for example `gh pr create --repo usememos/memos --base main --head gandazgul:<feature-branch>`, after pushing the branch to `origin`.
- Pre-existing dirty work (`CONTEXT.md`, `.wld/`, `docs/domain-language.md`, and `docs/issues/`) must remain untouched and must not be included in the implementation commit or pull request.
