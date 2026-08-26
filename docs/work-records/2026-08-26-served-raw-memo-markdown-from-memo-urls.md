---
kind: "work_record"
recordId: "74ebcec3-e915-4e05-a656-951a72901eeb"
status: "approved"
scope: "planned_change"
workKind: "FEATURE"
origin: "internal"
completionMode: "verified"
createdAt: "2026-08-26T16:33:40.728Z"
tickets:
    - url: "https://github.com/usememos/memos/issues/6229"
provenance:
    sourcePlans:
        - "8dc103a7-d845-483f-b89b-800768e7d419"
---
# Served raw Memo Markdown from memo URLs

## Summary

Implemented verified native Markdown responses for memo detail URLs. `GET /memos/{uid}.md` and explicit `Accept: text/markdown` on `GET /memos/{uid}` now return exact memo source with existing memo-read authorization, safe no-store Markdown headers, and preserved SPA fallback for browser/default requests. The change closes upstream issue #6229 and was delivered in PR #6235.

## Deviations from Plan

Verification used CI-compatible golangci-lint v2.13.1 because the preinstalled v2.12.2 could not load the Go 1.27 config. Broad `go test ./...` was killed under default package parallelism, then passed with `go test -p 1 ./...`.

## Future Planning Notes

Native representation routes that overlap SPA URLs must be registered before generated gateway routes and must treat wildcard Accept headers as HTML fallback, not content negotiation for raw data. Reusing `ResolveMemoReadFacts`, viewer facts, and `CheckMemoReadContext` kept authorization aligned with normal memo reads, and evaluating anonymous public access before credential parsing preserved stale-cookie public reads.