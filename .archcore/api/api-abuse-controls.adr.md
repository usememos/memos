---
title: "API abuse controls"
status: draft
tags:
  - "api"
---

## Context
Status: Accepted (2026-09-12).

Password guesses, anonymous URL fetches, account creation, and expensive writes need budgets before they consume work. The decision combines shared authorization with handler-specific checks; implementation exists in @internal/ratelimit/ratelimit.go and @server/api/v1/ratelimit.go. Forged forwarding headers make an unqualified per-address limit ineffective, so client identity is resolved centrally in @internal/clientip.

## Decision
Use a declarative in-process sliding-window limiter with shared catch-all budgets, handler-level flow budgets, trusted-proxy client resolution, structured throttle errors, and optional challenge/signup-policy seams.

## Decision Details
The shared authorizer covers anonymous callers by client address and authenticated callers by user ID after successful access checks. Specific handlers add tighter budgets where request fields or operation cost are known.
Batch cost equals item count: the authorizer charges one, and validated batch handlers account for the remaining items. Refusal precedes guarded password hashing, remote fetches, and writes.
Sign-in consumes before credential verification and refunds proven credentials, including later rejection for archived users or disabled password authentication. Failed passwords, unknown accounts, and rejected SSO exchanges keep the charge.
The submitted username keys the account budget regardless of whether the account exists. Sessions refreshed from a refresh token feed nothing; the token is the proof. Admin account creation uses the authenticated budget.
The address resolver uses the peer unless it is trusted, then walks forwarded addresses from the right past trusted proxies. `X-Real-Ip` fallback is considered only for a trusted peer; handlers and session records read the resolved context.
The default proxy policy is `private` (loopback, RFC 1918, link-local, unique-local); `none` or explicit CIDRs suit deployments with hostile private peers or NAT/header ambiguity.
Atomic consumption prevents concurrent guesses from all spending the same remaining allowance. A refused consume charges nothing; retry delay is the first whole second whose estimated window permits retry, not merely a window boundary.
State is in memory with a capacity cap and bounded expired-entry sampling. Capacity failure allows requests and logs at most one warning per minute; restart clears state. Failing open is deliberate and has precedent in Google's own enforcement guidance: a limiter that fails closed under memory pressure is a self-inflicted outage.
The default `rate-limit` switch is on; deployments can disable it or replace policy/limiter implementations. Defaults are starting values without workload measurements, not a proven capacity guarantee.
Enabling the limiter by default is a behavior change for self-hosters, and the cloud plan's rule was that no precondition changes behavior when unconfigured. This is the one deliberate exception: brute-force protection is a recurring self-host request, the defaults are sized to be invisible in ordinary use, and shipping it off by default would leave most instances with the exposure the feature exists to close. The release notes call out the switch.
Throttle responses use `RESOURCE_EXHAUSTED`, HTTP 429, `ErrorInfo.reason=RATE_LIMITED`, domain `memos.api.v1`, metadata, `RetryInfo`, `Retry-After`, `RateLimit`, and `RateLimit-Policy` (@server/api/v1/ratelimit.go).
The public message is generic; structured metadata and logs carry the scope. Future quotas reserve `QUOTA_EXCEEDED` with `QuotaFailure` rather than retry advice. The web app's error handler reads the reason, so one handler covers both: a throttle shows a wait message, a quota refusal shows an upgrade link when the instance profile carries one.
An optional server-side challenge verifies `Challenge-Token` for non-admin signup and password sign-in, excluding first-user setup. Missing/failed proofs use `FAILED_PRECONDITION` and `CHALLENGE_REQUIRED`; an absent challenge changes no request requirements.
Challenge provider/site-key metadata supports configured widgets without a provider SDK in the server. Optional signup policy receives canonical email/client IP after validation and before creation, returning `PERMISSION_DENIED` on rejection.

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

## Alternatives Considered
- **Trust `X-Forwarded-For` as today and rate-limit on it:** rejected because a forged header gives every request a fresh bucket, and the limiter would protect nothing.
- **Trust no proxy by default:** rejected because most self-host installs sit behind a reverse proxy on the same host, and every user would share one bucket; `private` covers that layout without trusting the public internet.
- **Enforce every limit in handlers:** rejected because the catch-all budgets need only the procedure and identity, which the shared authorizer already has on both transports, and enforcing them there is the only way to guarantee no procedure is left unbounded. The per-flow limits stay in handlers because they need request fields.
- **Enforce every limit in an Echo middleware by path:** rejected because the sign-in check needs the submitted username and the signup check needs the admin decision, both known only inside the handler.
- **Distinguish throttle from quota by detail type alone:** rejected because AIP-193 makes `ErrorInfo.reason` the discriminator and mandates the detail. Detail types remain as supplements.
- **Token bucket from `golang.org/x/time/rate`:** rejected because it cannot count only failures without a refund step; a window counter is smaller and expresses the rule directly.
- **Lock an account after N failures:** rejected because a lockout lets an attacker deny service to any account by name; a short window per submitted name slows guessing without a lockout state to manage.
- **Require authentication for link metadata instead of limiting it:** rejected because anonymous readers of a public instance need previews for public memos; a per-address limit keeps the endpoint usable while closing the proxy abuse.
- **Put the challenge token in the request protos:** rejected because the challenge is a transport concern of two forms; a header keeps the proto free of a field that is meaningless on self-host and to MCP clients.
- **Ship the limiter off by default:** rejected; see the default-on exception in Decision Details.
- **Per-scope tuning through instance settings and an admin UI:** rejected for the initial version because operators can turn the limiter off and deployments tune through the policy seam; knobs can be added when a self-host need appears.
- **Persist limiter state in the database:** rejected because of write amplification on every request for state that is fine to lose on restart.

## Consequences
### Positive
- Catch-all and flow budgets apply through the same API authorization paths across transports.
- Retry metadata distinguishes temporary throttling from future quota exhaustion.
- Deployment policy can change without duplicating handlers.
### Tradeoffs
- State and protection reset at restart and do not coordinate across multiple server nodes.
- Fail-open behavior prioritizes availability when the limiter cannot allocate state.
- Trusting private peers by default permits forwarding spoofing on hostile private networks unless operators override the policy.
- Default-on throttling changes self-host behavior; policy numbers remain uncalibrated.
- Refusal logs include client addresses and account keys; the initial design adds no metrics backend.

## Deferred Work
Adaptive challenges shown only after failures, per-scope tuning in the admin UI, a shared limiter for more than one node, bans and IP reputation, disposable-domain lists in the open-source binary, content-quality spam detection, enumeration-safe signup, metrics export, byte-based quotas, and limits on file and avatar serving remain deferred. Later work must preserve the single client-address resolver, the two-layer enforcement of catch-all budgets in the authorizer and per-flow limits in handlers, check-before-work ordering, the AIP-193 error shape, and identical behavior for existing and non-existing account names.
