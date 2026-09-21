---
title: "Rate limiting and challenge contract"
status: draft
tags:
  - "api"
---

## Purpose & Scope
Status: Accepted (2026-09-12).

This spec defines the API abuse-control contract: client-address resolution, the in-process limiter and its default policy, enforcement points, the refusal error contract, and the challenge and signup-policy seams. It is normative for @internal/clientip/clientip.go, @internal/ratelimit/ratelimit.go, @server/api/v1/authz.go, @server/api/v1/ratelimit.go, and the guarded service methods under @server/api/v1. API clients, the web app, operators, session records, and deployments that fill the seams depend on it; Connect, the gRPC gateway, and MCP through the HTTP API all pass it.
Out of scope: distributed or persistent limiting, captcha implementations or provider SDKs, bans, reputation, disposable-domain lists, byte quotas, content-quality checks, enumeration-safe signup, metrics, and file or avatar serving limits.

## Surface
- `clientip.ParseTrustedProxies`, `Resolver.Resolve`, `clientip.Middleware`, `clientip.FromContext` (@internal/clientip/clientip.go).
- `ratelimit.Limiter` with `Consume`, `Refund`, `Allowed`, `Hit`; `ratelimit.Decision{Allowed, Rule, Remaining, RetryAfter}`; `ratelimit.Policy` and `DefaultPolicy()`; `MemoryLimiter` (@internal/ratelimit/ratelimit.go).
- `Authorizer.Throttle` (@server/api/v1/authz.go); handler helpers `throttleAndCharge`, `chargeBatch`, `reserveSignIn` (@server/api/v1/ratelimit.go).
- Refusal builders `newRateLimitError`, `newChallengeRequiredError`, `rateLimitHTTPHeaders` (@server/api/v1/ratelimit.go); `APIV1Service.Challenge` and `APIV1Service.SignupPolicy` fields (@server/api/v1/v1.go).
- `ratelimit.Challenge` (`Verify(ctx, scope, token, clientIP)`, `Provider()`, `SiteKey()`) and `ratelimit.SignupPolicy` (`AllowSignup(ctx, canonicalEmail, clientIP)`); request header `Challenge-Token`; optional instance-profile message `challenge` with `provider` and `site_key` (@proto/api/v1/instance_service.proto), absent on self-host; web widget for Cloudflare Turnstile and hCaptcha (@web/src/components/ChallengeWidget.tsx).
- Profile options `rate-limit` (boolean, default on) and `trusted-proxies` (default `private`) (@cmd/memos/main.go, @internal/profile/profile.go).
- Scopes, keys, and defaults of `DefaultPolicy()`: `anonymous` (client address, 300/min), `authenticated` (user id, 600/min), `signin_ip` (address, 30/15 min), `signin_account` (submitted username, 10/15 min), `signup_ip` (address, 10/h), `validate_ip` (address, 60/min), `password_reset_ip` (address, 10/h), `password_reset_email` (canonical email, 3/h), `link_metadata` (address, or user id when authenticated, 60/min), `upload_user`, `write_user` (user id, 120/min each), `transcribe_user` (user id, 20/h), `archive_user` (user id, 10/h).

## Normative Behavior
Client identity
1. WHEN the peer address is not a trusted proxy, the resolver MUST return the peer and ignore forwarding headers.
2. WHEN the peer is trusted, the resolver MUST walk `X-Forwarded-For` from the right, skipping trusted entries, and return the first untrusted entry.
3. IF every forwarded entry is trusted or the header is absent, THEN the resolver MUST use `X-Real-Ip` only for a trusted peer, else the peer.
4. The `trusted-proxies` option MUST accept CIDRs plus the keywords `private` (loopback, RFC 1918, link-local, unique-local) and `none` (trust nothing).
5. The resolver MUST run once in an Echo middleware ahead of every route and store the address in the request context.
6. The authorizer, every handler, and session records MUST read the client address from the context, never from a request header.

Limiter
7. `Consume` MUST admit and record in one critical section, so concurrent requests cannot share one remaining unit.
8. IF `Consume` refuses, THEN the limiter MUST charge nothing.
9. The limiter MUST report as the retry delay the first whole second at which a retry would be admitted, not the window boundary.
10. The limiter MUST keep state in memory, keyed by scope and key, under a capacity cap.
11. WHEN a new key arrives at capacity, the limiter MUST inspect a bounded sample of entries and evict the expired ones.
12. WHEN `rate-limit` is off, the server MUST disable every scope.
13. A deployment MAY replace the policy table and the limiter implementation without changing handlers.

Enforcement points
14. WHEN `CheckAccess` succeeds, the authorizer MUST consume one unit of `authenticated` for an identified caller, else `anonymous` by client address.
15. WHEN a batch handler has validated its request, the handler MUST charge `items - 1` more to the caller's catch-all budget.
16. `SignIn` MUST consume one `signin_ip` unit before the user lookup and before bcrypt.
17. WHEN `SignIn` carries password credentials, the service MUST also consume one `signin_account` unit keyed by the submitted username.
18. WHEN the credential is proven, `SignIn` MUST refund both units, including when an archived user or disabled password auth then refuses sign-in.
19. WHEN the password is wrong, the username is unknown, or the SSO exchange is rejected, `SignIn` MUST keep the units.
20. `signin_account` MUST count the submitted username identically whether or not the account exists.
21. Sessions refreshed from a refresh token MUST NOT feed any flow scope.
22. WHEN a non-admin caller invokes `CreateUser`, the service MUST consume `validate_ip` with `validate_only`, else `signup_ip`.
23. `CreateUser` MUST check its signup scope after the admin check and before any store call.
24. Admin-authenticated `CreateUser` MUST feed only the `authenticated` budget.
25. `GetLinkMetadata` and `BatchGetLinkMetadata` MUST consume `link_metadata` at one unit per URL before any fetch, including cached results.
26. Upload start and `CreateAttachment` MUST consume `upload_user` after authentication.
27. `Transcribe` MUST consume `transcribe_user` before the model call.
28. Memo, comment, reaction, share, memo-view, and webhook creation MUST consume `write_user` before the store call.
29. `ExportMemos` and the `ImportMemos` upload start MUST consume `archive_user`.
30. The password-reset flow MUST consume `password_reset_ip` and `password_reset_email` when that RPC exists.

Error contract
31. WHEN a limit refuses a request, the server MUST return `RESOURCE_EXHAUSTED` with message `too many requests, try again later`.
32. The refusal MUST carry `google.rpc.ErrorInfo` with reason `RATE_LIMITED` and domain `memos.api.v1`.
33. The `ErrorInfo` metadata MUST carry `scope`, `retry_after_seconds`, `limit`, `window_seconds`, and `remaining`.
34. The refusal MUST carry `google.rpc.RetryInfo` with the same delay.
35. Connect and the gRPC gateway MUST map the refusal to HTTP 429 with `Retry-After`, `RateLimit`, and `RateLimit-Policy` headers.
36. The web app's error handler reads `ErrorInfo.reason`, so one handler covers both refusals: a throttle shows a wait message, and a quota refusal shows an upgrade link when the instance profile carries one.

Challenge and signup policy
37. WHILE a challenge is configured, non-admin `CreateUser` and password `SignIn` MUST require a `Challenge-Token` verified server-side.
38. Both transports MUST forward the `Challenge-Token` header into request metadata.
39. IF the token is missing or fails verification, THEN the service MUST return `FAILED_PRECONDITION` with `ErrorInfo.reason` `CHALLENGE_REQUIRED`.
40. First-user setup MUST NOT ask for a challenge token.
41. WHILE a challenge is configured, the instance profile MUST expose `challenge.provider` and `challenge.site_key`.
42. WHEN the profile carries `challenge`, the web app MUST render the provider widget unconditionally on signup and sign-in forms and attach the token.
43. The open-source binary MUST NOT import a challenge provider SDK.
44. WHEN a non-admin `CreateUser` has passed validation, the service MUST call `SignupPolicy.AllowSignup` with the canonical email and client address before the store write.
45. IF the signup policy returns an error, THEN the service MUST return `PERMISSION_DENIED` with the policy's message.

Observability
46. WHEN a request is refused, the server MUST log one info line with the scope and the key.
47. The refusal log MUST carry the client address as-is and the account key for `signin_account`.

## Constraints & Invariants
- The default numbers are starting values sized for a household or small office behind one address; they are not tuned against measurements.
- The open-source binary has no per-scope knobs; tuning goes through the policy seam.
- A request can be refused by its catch-all or its specific scope; the first refusal wins.
- Every request that passes authorization is counted against a catch-all budget; no procedure is unbounded.
- Batch procedures cost their item count, never one.
- Rate-limit checks run before password hashing, before any outbound fetch, and before any store write on the paths they guard.
- A limit keyed on an account name behaves the same for existing and non-existing accounts.
- The per-account sign-in limit does not depend on the client address, so it holds under forged forwarding.
- Under the default `private`, any private-network peer is believed when it forwards an address.
- Reason `QUOTA_EXCEEDED` with a `QuotaFailure` detail and no `RetryInfo`, under the same code, is reserved for future quota refusals.
- The api protos never import `google.rpc`; the web app decodes the three-field `ErrorInfo` by hand (@web/src/lib/error.ts).
- Rate-limit refusals carry no free-text information about which limit tripped or whether an account exists; the scope is in structured metadata and logs only.
- The open-source code never treats the presence of a challenge token as success.
- Turning the limiter off restores unlimited behavior exactly; an unset challenge or signup policy adds no request, header, or field.

## Failure Behavior
1. IF the sampled entries hold nothing expired at capacity, THEN the limiter MUST allow the request (fail open).
2. WHILE the limiter fails open, the limiter MUST log a warning at most once per minute.
3. WHEN the server restarts, the limiter MUST start with empty state.
4. IF other private-network hosts are hostile, or a NAT hop presents a private peer without rewriting headers, THEN the operator SHOULD set `none` or list the real proxy.

## Conformance
An implementation is conformant when it satisfies behaviors 1–35 and 37–47, holds every invariant, and follows the failure rules; clause 36 describes the web client. Evidence: limiter unit tests with a fake clock (@internal/ratelimit/ratelimit_test.go), resolver table tests (@internal/clientip/clientip_test.go), authorizer, handler, and transport tests (@server/test/ratelimit_test.go, @server/api/v1/test/ratelimit_test.go), and error-contract tests (@server/api/v1/ratelimit_test.go).
Given `signin_account` has spent 10 failures for `alice` in 15 minutes,
When an 11th password sign-in for `alice` arrives,
Then the server refuses it before the user lookup and bcrypt, whether or not `alice` exists.
