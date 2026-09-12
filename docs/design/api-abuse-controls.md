# API Abuse Controls Design

Status: Accepted

Date: 2026-09-12

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [Unique Email Design](unique-email.md), [Multi-Spaces Design](multi-spaces.md)

## Summary

Memos has no rate limiting anywhere. A single client can guess passwords, create accounts, make the server fetch arbitrary URLs, or flood writes as fast as the server answers. On a private self-hosted instance the exposure is brute force against the admin account; on a public instance it is an open door.

This design adds a small in-process limiter driven by a declarative policy table, enforced in two places: catch-all request budgets in the shared authorizer that every transport passes through, and tight per-flow limits inside the handlers that need request fields. It defines one error contract for "slow down" that follows Google's API Improvement Proposals and the IETF rate-limit headers, and two seams a deployment fills: a challenge verifier and a signup policy. Everything ships in the open-source binary with conservative defaults, one switch to turn it off, and one setting that says which proxies to trust when reading the client address.

## Goals

- Bound failed sign-in attempts per client address and per submitted account name, so password guessing is slow and the server does not spend bcrypt time on floods.
- Bound account creation, link-metadata fetches, uploads, AI transcription, and content writes, each per the identity that best describes the caller.
- Give anonymous callers on a public instance one overall request budget, and authenticated callers another, so no endpoint needs its own rule to be protected at all.
- Count batch requests by their item count, so batching cannot bypass a limit.
- Reserve named limits for password reset so that flow plugs in without a new design.
- Derive the client address in one place from a configurable set of trusted proxies, so the limiter cannot be bypassed with a forged header and the sessions page stops showing forged addresses.
- Return one error contract that generic clients, the web app, and the future metering work all understand.
- Expose a challenge seam and a signup-policy seam that a deployment fills without changing the open-source code paths.

## Non-goals

- A distributed or persistent limiter. cloud.usememos.com is one node; self-host is one node. The limiter interface allows another implementation later.
- A captcha implementation, provider SDK, or admin UI for choosing one.
- Bans, IP reputation, disposable-domain lists, or moderation tooling.
- Byte-based upload, storage, or AI quotas. Those are metering, designed separately; this design only reserves the error reason they will use.
- Content-quality spam detection. A write budget bounds volume, not intent.
- Limits on file and avatar serving. That is bandwidth, best handled by a cache in front of the instance.
- Enumeration resistance beyond what sign-in already does. Signup with a taken email still returns `AlreadyExists`; email verification is the design that changes that.

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

Research completed on 2026-09-12 compared the API Improvement Proposals, Google's service-configuration quota model, the IETF rate-limit header draft, and OWASP API Security Top 10.

| Source | What it prescribes | What Memos takes from it |
| --- | --- | --- |
| AIP-193 Errors | Every error is a `google.rpc.Status` with a canonical code and a mandatory `ErrorInfo` detail carrying a stable `reason`, a `domain`, and `metadata` for the dynamic parts. | One code, `RESOURCE_EXHAUSTED`, with the reason distinguishing a throttle from a quota. |
| AIP-194 Automatic retry | `RESOURCE_EXHAUSTED` is generally non-retryable because it usually means quota, unless the server signals a short recovery. | Throttles must carry `RetryInfo`; quota refusals must not. |
| `google.api.Quota` service config | Limits are declared as a table of metrics, per-method costs, and per-consumer limits per window. Enforcement is one allocate call; infrastructure failure fails open. | A policy table with per-method costs and one consumer key per caller kind; fail-open as a stated invariant. |
| IETF `draft-ietf-httpapi-ratelimit-headers-11` (May 2026) | `RateLimit` and `RateLimit-Policy` structured header fields; `Retry-After` takes precedence on a 429. | Emit both on every refusal so generic HTTP clients behave. |
| OWASP API4:2023 | Rate limits per client, user, and address; per-operation throttles on login, one-time codes, and password recovery; caps on payload size and on operations per request; spending limits on third-party calls. | The tight per-flow scopes, batch-as-item-count, and the link-metadata and transcription limits. |

There is no AIP that prescribes a rate-limiting policy. The AIPs fix the error shape; Google's actual enforcement lives in service configuration outside the service code. The declarative-table idea transfers; the centralized allocate service does not, since Memos is one process.

## Proposed design

### Client identity

One resolver in a new `internal/clientip` package turns a request into a client address:

1. Take the peer address of the TCP connection.
2. If the peer is not in the trusted-proxy set, the client address is the peer. Forwarding headers are ignored.
3. If the peer is trusted, walk `X-Forwarded-For` from the right, skipping entries that are themselves trusted proxies. The first untrusted entry is the client. If every entry is trusted or the header is absent, fall back to `X-Real-Ip` only if the peer is trusted, else to the peer.

The trusted-proxy set is a profile option, `trusted-proxies`, set the same way as the other profile options. It accepts a list of CIDRs and two keywords: `private` expands to loopback, RFC 1918, link-local, and unique-local ranges; `none` trusts nothing. The default is `private`. That matches the common self-host layout, a reverse proxy on the same host or Docker network, without trusting the public internet. An operator whose proxy sits on a public address lists it explicitly.

The resolver runs once, in an Echo middleware ahead of every route, and stores the result in the request context. Both transports derive their handler context from that request, so the authorizer and every handler read the address from the context and never from a header. `extractClientInfo` switches to it, so session records stop trusting forged headers as a side effect.

### Limiter

A new `internal/ratelimit` package provides a sliding-window counter:

```text
Allowed(scope, key, cost) Decision{Allowed, Rule, Remaining, RetryAfter}
Hit(scope, key, cost)
```

`Allowed` is a read that asks whether `cost` more units fit; `Hit` records them. Separating them lets sign-in count only failures: check before doing work, record after the failure. A token bucket cannot express "consume on failure" without a refund step, which is why the simpler counter is chosen.

State lives in memory, keyed by `scope + key`, with a capacity cap and eviction of expired windows first. When the cap is reached and nothing has expired, the limiter allows the request and logs a warning once per minute. Failing open is deliberate and has precedent in Google's own enforcement guidance: a limiter that fails closed under memory pressure is a self-inflicted outage, and the capacity cap only matters to an attacker who controls that many real source addresses, since forged addresses are no longer counted.

A restart clears all state. That is acceptable for abuse control on one node.

### Policy table

A `ratelimit.Policy` is a table. Each row names a scope, the kind of key it is counted against, a limit, a window, and which procedures feed it with what cost. The open-source binary ships a default table; the server options seam planned for the cloud module accepts a replacement table and a replacement limiter, so a deployment tightens numbers or backs the limiter with shared storage without touching the handlers.

| Scope | Key | Feeds it | Counts | Default |
| --- | --- | --- | --- | --- |
| `anonymous` | client address | every procedure reached without an identity | each request; batch requests cost their item count | 300 per minute |
| `authenticated` | user id | every procedure reached with an identity | each request; batch requests cost their item count | 600 per minute |
| `signin_ip` | client address | `SignIn` | failed password and SSO sign-ins | 30 per 15 minutes |
| `signin_account` | submitted username, as submitted | `SignIn` with password credentials | failed sign-ins | 10 per 15 minutes |
| `signup_ip` | client address | `CreateUser` by a non-admin caller, not `validate_only` | every attempt | 10 per hour |
| `validate_ip` | client address | `CreateUser` with `validate_only` | every attempt | 60 per minute |
| `password_reset_ip` | client address | reserved for the reset flow | every attempt | 10 per hour |
| `password_reset_email` | canonical email | reserved for the reset flow | every attempt | 3 per hour |
| `link_metadata` | client address, or user id when authenticated | `GetLinkMetadata`, `BatchGetLinkMetadata` | each URL | 60 per minute |
| `upload_user` | user id | upload start, `CreateAttachment` | every start | 120 per minute |
| `transcribe_user` | user id | `Transcribe` | every call | 20 per hour |
| `write_user` | user id | memo, comment, reaction, share, memo-view, and webhook creation | every call | 120 per minute |

The two catch-all scopes are what make the table complete: a procedure nobody thought to list is still bounded. The specific scopes sit on top with tighter numbers. A request can therefore be refused by either its catch-all or its specific scope, and the first refusal wins.

The numbers are starting points chosen so that a household or small office behind one address is never throttled in ordinary use, while a password guesser is held to a few hundred attempts a day per address and an anonymous fetcher cannot turn the instance into a proxy. They are not tuned against measurements and are expected to change.

`signin_account` is keyed on the submitted username whether or not such a user exists. If it counted only real accounts, hitting the limit would reveal that the account exists.

A failed sign-in is a wrong password, an unknown username, or a rejected SSO exchange. A sign-in refused because the user is archived or password auth is disabled has already proven the credential and is not counted. Admin-authenticated `CreateUser` feeds only the `authenticated` budget. Sessions refreshed from a refresh token feed nothing; the token is the proof.

### Enforcement points

The catch-all budgets are enforced once, in the shared authorizer, immediately after `CheckAccess` succeeds. At that point the identity is known on either transport, and the MCP adapter passes the same code. The authorizer counts one unit per request; it cannot see item counts because the gateway has not parsed the body yet. The batch handlers add the rest, `items - 1`, to the caller's catch-all budget once they have validated the request, so a batch of n items costs n in total.

The specific scopes are enforced in the service methods, because they need request fields:

- `SignIn`, before the user lookup and before bcrypt: `signin_ip` and, for password credentials, `signin_account`. On failure, `Hit` both. On success, neither.
- `CreateUser`: `signup_ip` or `validate_ip` after the admin check and before any store call.
- `GetLinkMetadata` and `BatchGetLinkMetadata`: `link_metadata`, costing the number of URLs, before any fetch. Cached results still cost, since the point is to bound how often a caller can ask.
- Upload start and `CreateAttachment`: `upload_user` after authentication.
- `Transcribe`: `transcribe_user` before the model call.
- The write procedures: `write_user` before the store call.
- The reset scopes are defined and tested against the limiter now; the reset RPC calls them when it exists.

### Error contract

A refused request returns `RESOURCE_EXHAUSTED` with two details:

- `google.rpc.ErrorInfo` with `reason` `RATE_LIMITED`, `domain` `memos.usememos.com`, and `metadata` carrying `scope`, `retry_after_seconds`, `limit`, `window_seconds`, and `remaining`.
- `google.rpc.RetryInfo` carrying the same delay, so a client following AIP-194 knows this refusal recovers in seconds rather than hours.

Connect and the gRPC gateway both map the code to HTTP 429. Both error writers also set `Retry-After` from the delay and a `RateLimit` structured header with the remaining count and the window, following the IETF draft. `RateLimit-Policy` is emitted alongside so a client can learn the rule that tripped.

The metering work will use the same code with `reason` `QUOTA_EXCEEDED`, a `QuotaFailure` detail, and no `RetryInfo`. The web app's error handler reads the reason, so one handler covers both: a throttle shows a wait message, a quota refusal shows an upgrade link when the instance profile carries one. The api protos never import `google.rpc`, so the web app decodes the three-field `ErrorInfo` by hand rather than generating a schema for it.

`Status.message` is generic: "too many requests, try again later". It does not say which scope tripped; the scope is in the structured metadata for clients that want it, and the log line has it for the operator.

### Challenge seam

`ratelimit.Challenge` is an interface with `Verify(ctx, scope, token, clientIP) error` plus `Provider()` and `SiteKey()`, which feed the instance profile. The default is nil, meaning no challenge is configured. A deployment supplies one by setting the field on the API service.

When a challenge is configured, `CreateUser` for non-admin callers and `SignIn` with password credentials require a token. The token travels in the `Challenge-Token` request header; the Connect metadata interceptor forwards it, and the gateway's incoming-header matcher is extended to do the same. A missing or failed token returns `FAILED_PRECONDITION` with `ErrorInfo.reason` `CHALLENGE_REQUIRED`, distinct from the rate-limit code so the web app renders the widget rather than a wait message.

The instance profile gains one optional message, `challenge`, with `provider` and `site_key` strings, absent on self-host. When present, the web app renders the provider's widget on the signup and sign-in forms and attaches the token to those requests. The web app knows the Cloudflare Turnstile and hCaptcha widgets, which share one explicit-render API; adding a provider is a web change plus a private verifier. Rendering is unconditional when configured; adaptive challenges that appear only after failures are deferred. First-user setup renders no widget and the server asks for no token there. The open-source binary never imports a provider SDK.

### Signup policy seam

`ratelimit.SignupPolicy` is an interface with one method, `AllowSignup(ctx, canonicalEmail, clientIP) error`. The default allows everything. `CreateUser` calls it for non-admin callers after validation and before the store write. A returned error surfaces as `PERMISSION_DENIED` with the policy's message. This is where a deployment attaches domain blocklists, disposable-address checks, or geographic rules. Like the challenge, a deployment supplies it by setting the field on the API service; the functional-options constructor planned for the cloud module wraps those fields when it arrives.

### Configuration

Two profile options, set like the existing ones:

- `rate-limit`: boolean, default on. Off disables every scope. There are no per-scope knobs in the open-source binary; tuning goes through the policy seam.
- `trusted-proxies`: described above, default `private`.

Enabling the limiter by default is a behavior change for self-hosters, and the cloud plan's rule was that no precondition changes behavior when unconfigured. This is the one deliberate exception. Brute-force protection is a recurring self-host request, the defaults are sized to be invisible in ordinary use, and shipping it off by default would leave most instances with the exposure the feature exists to close. The release notes call out the switch.

### Observability

Every refusal logs one info line with the scope and the key. The client address is logged as-is; the account key is logged for `signin_account` because the operator needs to see which account is under attack. No metrics system exists; nothing beyond logs is added.

### Security invariants

- The client address used for any limit or session record comes from the resolver and never directly from a request header.
- Every request that passes authorization is counted against a catch-all budget; there is no procedure the table does not bound.
- Batch procedures cost their item count, never one.
- Rate-limit checks run before password hashing, before any outbound fetch, and before any store write on the paths they guard.
- A limit keyed on an account name behaves the same for accounts that exist and accounts that do not.
- Rate-limit refusals carry no free-text information about which limit tripped or whether an account exists.
- Challenge tokens are verified server-side on every use; the open-source code never treats the presence of a token as success.
- The limiter fails open under its own failure; it never turns an infrastructure problem into an outage.
- Turning the limiter off restores today's behavior exactly, and an unset challenge or signup policy adds no request, header, or field.

### Testing

- Limiter unit tests with a fake clock: window boundaries, `Allowed` without `Hit`, costs, eviction order, fail-open at capacity with the once-per-minute warning.
- Resolver table tests: untrusted peer with a forged `X-Forwarded-For`, trusted peer with a chain of trusted and untrusted entries, `none`, explicit CIDRs, IPv6, and a missing header.
- Authorizer tests: an anonymous burst trips `anonymous` on both transports; an authenticated burst trips `authenticated`; a batch of one hundred usernames costs one hundred; MCP calls with a bearer token are counted against the user.
- Handler tests: after the limit, `SignIn` returns 429 without calling the store or bcrypt; a successful sign-in does not count; `signin_account` trips identically for a real and a made-up username; admin `CreateUser` feeds only the catch-all; `validate_only` and real signup use separate scopes; link metadata costs per URL and refuses before fetching.
- Transport tests: both Connect and the gateway return HTTP 429 with `Retry-After`, `RateLimit`, `RateLimit-Policy`, an `ErrorInfo` with reason `RATE_LIMITED`, and a `RetryInfo`; both forward `Challenge-Token`; both strip a client-supplied `x-memos-client-ip`.
- A test challenge and a test signup policy wired through the server options, asserting the `FAILED_PRECONDITION` and `PERMISSION_DENIED` paths.

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Trust `X-Forwarded-For` as today and rate-limit on it | Rejected; a forged header gives every request a fresh bucket, and the limiter would protect nothing. |
| Trust no proxy by default | Rejected; most self-host installs sit behind a reverse proxy on the same host, and every user would share one bucket. `private` covers that layout without trusting the public internet. |
| Enforce every limit in handlers | Rejected; the catch-all budgets need only the procedure and identity, which the shared authorizer already has on both transports, and enforcing them there is the only way to guarantee no procedure is left unbounded. The per-flow limits stay in handlers because they need request fields. |
| Enforce every limit in an Echo middleware by path | Rejected; the sign-in check needs the submitted username and the signup check needs the admin decision, both known only inside the handler. |
| Distinguish throttle from quota by detail type alone | Rejected; AIP-193 makes `ErrorInfo.reason` the discriminator and mandates the detail. Detail types remain as supplements. |
| Token bucket from `golang.org/x/time/rate` | Rejected; it cannot count only failures without a refund step. A window counter is smaller and expresses the rule directly. |
| Lock an account after N failures | Rejected; a lockout lets an attacker deny service to any account by name. A short window per submitted name slows guessing without a lockout state to manage. |
| Require authentication for link metadata instead of limiting it | Rejected; anonymous readers of a public instance need previews for public memos. A per-address limit keeps the endpoint usable while closing the proxy abuse. |
| Put the challenge token in the request protos | Rejected; the challenge is a transport concern of two forms. A header keeps the proto free of a field that is meaningless on self-host and to MCP clients. |
| Ship the limiter off by default | Rejected; see Configuration. |
| Per-scope tuning through instance settings and an admin UI | Rejected for the initial version; operators can turn it off, and deployments tune through the policy seam. Knobs can be added when a self-host need appears. |
| Persist limiter state in the database | Rejected; write amplification on every request for state that is fine to lose on restart. |

## Deferred design

Adaptive challenges shown only after failures, per-scope tuning in the admin UI, a shared limiter for more than one node, bans and IP reputation, disposable-domain lists in the open-source binary, content-quality spam detection, enumeration-safe signup, metrics export, byte-based quotas, and limits on file and avatar serving remain deferred. Later work must preserve the single client-address resolver, the two-layer enforcement of catch-all budgets in the authorizer and per-flow limits in handlers, check-before-work ordering, the AIP-193 error shape, and identical behavior for existing and non-existing account names.
