# API Abuse Controls Design

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md) and [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

## Summary

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md).

## Goals

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md) and [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

## Non-goals

> Moved to [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

## Current state

Facts verified in the code on 2026-09-12:

- No rate limiter, lockout, attempt counter, or captcha exists in `server/`, `internal/`, or `store/`.
- `SignIn` looks the user up, runs bcrypt, and only then checks instance settings. Every request pays the hash cost.
- Both transports share one authorizer: the Connect interceptor and the gRPC-gateway middleware each call `Authenticate` and then `CheckAccess` with the procedure name. The MCP adapter forwards a bearer token through the same HTTP API, so it passes the same code. This is the one place that sees every request with its procedure and identity.
- The client address is read in `extractClientInfo` for session records: the first entry of `X-Forwarded-For`, else `X-Real-Ip`, with no notion of which proxies are trusted. Any client can choose the address that gets recorded.
- `GetLinkMetadata` and `BatchGetLinkMetadata` are anonymous-allowed and fetch arbitrary URLs. They have private-address guards, a five-second timeout, a cache, and a batch cap of ten, but no per-caller limit.
- `Transcribe` is authenticated and caps audio at 25 MiB. Memo, comment, reaction, and share creation are authenticated with no ceiling.
- Batch endpoints already cap their item counts: one hundred usernames, ten URLs. Pages are capped at one thousand items.
- Request bodies are capped at the gateway per procedure, with a larger cap for the upload procedure.

## Research

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md).

## Proposed design

> Moved to [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

### Signup policy seam

> Moved to [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

`ratelimit.SignupPolicy` is an interface with one method, `AllowSignup(ctx, canonicalEmail, clientIP) error`. The default allows everything. `CreateUser` calls it for non-admin callers after validation and before the store write. A returned error surfaces as `PERMISSION_DENIED` with the policy's message. This is where a deployment attaches domain blocklists, disposable-address checks, or geographic rules. Like the challenge, a deployment supplies it by setting the field on the API service; the functional-options constructor planned for the cloud module wraps those fields when it arrives.

### Testing

> Moved to [`.archcore/api/abuse-contract.spec.md`](../../.archcore/api/abuse-contract.spec.md).

- Transport tests: both Connect and the gateway return HTTP 429 with `Retry-After`, `RateLimit`, `RateLimit-Policy`, an `ErrorInfo` with reason `RATE_LIMITED`, and a `RetryInfo`; both forward `Challenge-Token`; both strip a client-supplied `x-memos-client-ip`.

## Alternatives considered

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md).

## Deferred design

> Moved to [`.archcore/api/api-abuse-controls.adr.md`](../../.archcore/api/api-abuse-controls.adr.md).
