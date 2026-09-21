---
title: "Space memo access and placement"
status: draft
tags:
  - "spaces"
---

## Purpose & Scope
Status: Accepted (2026-08-23).
This spec defines memo authorization under Multi-Spaces: audience-based reads, the application-administrator bypass, feed distribution, participation in assigned memos, author control of placement and audience, and fail-closed delivery. It is normative for the shared memo policy (@core/access/memo.go), the memo write path (@server/api/v1/memo_service.go, @store/memo.go), and every surface that exposes memo content: API, files (@server/fileserver/fileserver.go), notifications, webhooks, live refresh, and MCP. API clients, the web app, and MCP clients depend on it.
Out of scope: the Space resource, membership, invitations, governance, and deletion (the sibling Space-membership spec); tenant isolation, collaborative editing, and memo moderation by Space admins.

## Surface
- Audience: v1 `Visibility` `PRIVATE`, `PROTECTED`, `PUBLIC`, `SPACE = 4`, with `VISIBILITY_UNSPECIFIED = 0` as an input sentinel (@proto/api/v1/memo_service.proto). Domain mapping: Author→`PRIVATE`, Instance→`PROTECTED`, Public→`PUBLIC`, Space→`SPACE`.
- Placement: nullable `memo.space_id` (NULL = Unassigned); memo responses carry an optional Space resource name; memo identity stays `memos/{uid}`.
- `access.CheckMemoReadContext`, `IsInstanceAdmin`, `CanManageMemo`, `CanManageAttachment` (@core/access/memo.go).
- CEL filter field `space` (@filter/schema.go); live-refresh frames `{"type":"memo.changed"}` and `{"type":"space.changed"}` (@server/api/v1/sse_hub.go).
- Comments: independent memos joined to a context memo by one immutable `COMMENT` relation in `memo_relation`; reactions belong to one memo.

## Normative Behavior
Reads and distribution
1. WHILE a memo is `PRIVATE`, the policy MUST admit only its active authenticated author.
2. WHILE a memo is `PROTECTED`, the policy MUST admit active authenticated users.
3. WHILE a memo is `PUBLIC`, the policy MUST admit active authenticated users, plus anonymous callers when instance policy permits.
4. WHILE a memo is `SPACE`, the policy MUST admit only active members of the assigned Space.
5. The policy MUST NOT add Space placement as an extra read gate for `PRIVATE`, `PROTECTED`, or `PUBLIC` memos.
6. WHEN a non-member reads an assigned memo, the API MUST NOT disclose Space metadata, membership, or the Space feed.
7. The API MUST return a memo's Space reference only to its author or an active member of that Space.
8. WHEN an unexpired bearer share names one memo, the policy MUST admit that exact memo only, without list, feed, Space, or related-memo access.
9. The policy MUST let an application `ADMIN` read any structurally valid memo by name, including archived and `SPACE` memos outside their Spaces.
10. The administrator bypass MUST cover point reads and their child resources (files, reactions, relations, comment creation) only.
11. Lists, counts, feeds, and the Space filter MUST keep the ordinary audience predicate for application administrators.
12. Global feeds MUST return readable memos that have no `COMMENT` relation.
13. WHEN a caller requests a Space feed, the service MUST first require active membership, then return readable assigned memos without a `COMMENT` relation.
14. WHEN a memo is read directly, the policy MUST evaluate that memo independently, including a comment.
15. WHEN a comment or conversation query runs, the service MUST require a readable context memo, then filter each reply by its own audience.
16. The API MUST return a `COMMENT` or `REFERENCE` relation and its snippet only when both endpoints are readable.
17. A readable comment's `parent` field MUST identify its context memo without granting access.
18. Bearer-share responses MUST omit the `parent` field.
19. WHEN a memo is readable, the API MUST expose its reactions.
20. An active reaction creator MAY withdraw their own reaction after losing memo access or Space membership.
21. Public profiles and other public surfaces MUST select by `PUBLIC`, not by Space placement.

Participation and placement
22. WHEN a caller comments on or reacts to an assigned memo, the service MUST require read access and active membership of its Space.
23. WHEN a comment is created, the service MUST authorize it independently as a new memo.
24. WHEN an author creates or assigns a memo in a Space, the service MUST require the author's active membership of the target Space.
25. WHEN a caller edits content or audience, or manages attachments, references, or shares, the service MUST require the author, plus active membership when assigned.
26. WHEN a caller deletes one memo, the service MUST require the memo author; the deletion removes no other memo.
27. The service MUST let only the memo author change placement, through the existing memo update API.
28. The author MAY delete, withdraw, or move an assigned memo without source membership.
29. WHEN an author moves a memo, the service MUST require active membership of the target Space.
30. The service MUST NOT change a memo's audience when it assigns the memo.
31. The author MAY change placement and audience in one atomic update.
32. WHEN a `SPACE` memo moves, the service MUST require both `space` and `visibility` in the update mask, confirming the new member audience.
33. WHEN a `SPACE` memo is withdrawn, the service MUST require a non-Space audience in the same update.
34. IF a memo is Unassigned, THEN the service MUST reject the `SPACE` audience.
35. The service MUST let an application `ADMIN` pass memo-local checks on every named memo operation without membership.
36. WHEN an administrator acts on a memo, the service MUST still require the placement and any target Space to exist.
37. The service MUST keep an attachment a superuser adds owned by the administrator.
38. WHEN an attachment is removed directly, the service MUST require its owner or an administrator; memo deletion still removes it.
39. WHEN a memo is created with `VISIBILITY_UNSPECIFIED`, the service MUST store `PRIVATE`.
40. IF an explicit visibility update carries `VISIBILITY_UNSPECIFIED`, THEN the service MUST reject it.
41. The API MUST NOT return `VISIBILITY_UNSPECIFIED` in a response.
42. The default memo visibility setting MUST accept only `PRIVATE`, `PROTECTED`, and `PUBLIC`.
43. The memo filter MUST accept `space == "spaces/{space}"`, `space == null`, and `space != null`, and saved views accept the same.

Delivery surfaces
44. WHEN a memo or reaction mutation succeeds, the server MUST broadcast `memo.changed`.
45. WHEN a Space, invitation, or membership mutation succeeds, the server MUST broadcast `space.changed`.
46. Live-refresh events MUST NOT carry a resource name, audience, actor, invitation, or membership data.
47. WHEN clients receive a live-refresh event, the clients MUST invalidate matching caches and refetch through ordinary authorization.
48. The server MUST authorize a notification when it is presented.
49. The server MUST authorize email and user-webhook payloads before they enter the asynchronous queue.
50. A comment webhook MUST require both the comment and its context memo to be readable by the webhook owner when prepared.
51. A deleted-memo webhook MUST be built only from an author-readable pre-delete snapshot.
52. The file server MUST send `private, no-store` for files of `PRIVATE`, `PROTECTED`, and `SPACE` memos.
53. The file server MAY send revalidation headers for files of `PUBLIC` memos.
54. MCP memo operations MUST use the same memo policy as the API.

## Constraints & Invariants
- Placement, audience, authorship, distribution, and relation context do not imply one another; audience values are named domains and are never compared numerically.
- One shared, memo-local, fail-closed policy covers point reads, lists, counts, files, reactions, relations, notifications, email, webhooks, shares, search, statistics, public feeds, and MCP; child resources resolve their direct memo.
- Database list and count authorization is applied before pagination: `PRIVATE`+active author, or `PROTECTED`+active caller, or `PUBLIC` permitted for caller, or `SPACE`+active membership in `memo.space_id`.
- CEL filters and Space filters only narrow that predicate. Membership is checked per request or through immediately invalidated cache state.
- Active shares and the `SPACE` audience exclude each other.
- Membership never makes another author's assigned `PRIVATE` memo readable.
- Relations grant no ownership, inheritance, or lifecycle authority; `COMMENT` relations are immutable.
- Live refresh is an authenticated, subject-free cache-invalidation channel; SSE neither materializes recipient sets nor performs memo-level authorization.
- Drivers resolve the administrator's role inside the mutation transaction with its lifecycle state; an archived administrator holds no privilege.

## Failure Behavior
1. IF a memo's visibility is unknown, THEN the policy MUST deny access.
2. IF placement is missing or invalid, THEN the policy MUST deny `SPACE` reads and placement-dependent operations; other audiences omit the invalid Space identity.
3. IF the actor is inactive, the invitation pending, the relationship state unknown, or the role invalid, THEN the policy MUST deny dependent access.
4. IF a caller creates a share for a `SPACE` memo, THEN the service MUST reject it.
5. IF a memo with active shares changes to `SPACE`, THEN the service MUST reject it until those shares are revoked.
6. IF a notification subject or relation endpoint is missing or unreadable, THEN the server MUST omit it without leaking partial metadata.
7. IF access changes while an email or webhook is queued, THEN the server MUST NOT cancel the delivery; the initial version provides no cancellation mechanism.
8. WHEN a client fetches an unreadable comment context, the client MUST render an unavailable context on permission denial or not-found.

## Conformance
An implementation is conformant when it satisfies behaviors 1–54, holds every invariant, and follows the failure rules (@core/access/memo_test.go, @server/api/v1/memo_comment_relations_test.go).
Given memo M is `PROTECTED` and assigned to Space S,
When an active non-member of S reads M by name,
Then the read succeeds and the response omits M's Space reference.
