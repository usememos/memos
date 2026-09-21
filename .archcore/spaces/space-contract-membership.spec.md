---
title: "Space membership and governance"
status: draft
tags:
  - "spaces"
---

## Purpose & Scope
Status: Accepted (2026-08-23).
This spec defines the Space resource and its membership contract: Space creation and governance, invitations and memberships, lifecycle and deletion, persistence, and the Space service API. It is normative for the Space service (@server/api/v1/space_service.go, @server/api/v1/space_service_notifications.go), the store (@store/space.go and the driver files under @store/db), the `0.31` migrations under @store/migration, and the Spaces settings UI (@web/src/components/Settings/SpacesSection.tsx). API clients, MCP `space_*` tools, the web app, and the memo authorization policy depend on it.
Out of scope: memo audience, reads, feeds, participation, and placement rules (the sibling memo-access spec); tenant isolation, per-Space authentication or settings, nested or multiple placement, guests, external invitations, open enrollment, and Space archival.

## Surface
- Space service (@proto/api/v1/space_service.proto): `CreateSpace`, `ListSpaces`, `GetSpace`, `UpdateSpace`, `DeleteSpace`; `ListSpaceMembers`, `GetSpaceMember`, `UpdateSpaceMember`, `DeleteSpaceMember`; `CreateSpaceInvitation`, `ListSpaceInvitations`, `ListUserSpaceInvitations`, `GetSpaceInvitation`, `DeleteSpaceInvitation`, `AcceptSpaceInvitation`, `DeclineSpaceInvitation`.
- Output-only Space projections `current_user_role` and `member_count`.
- Tables: `space(id, uid, title, description, …)` and `space_member(space_id, user_id, status, role)` with primary key `(space_id, user_id)` and role `CHECK (role IN ('ADMIN', 'USER'))` (@store/migration/sqlite/LATEST.sql).
- `space_member.status`: `INVITED` (exposed as a Space Invitation) or `ACTIVE` (exposed as a Space Membership); roles `ADMIN` and `USER`.
- Inbox type `SPACE_INVITATION` with its Space summary and offered role (@proto/store/inbox.proto).

## Normative Behavior
Resource and governance
1. A Space MUST be an instance-scoped collaboration resource that exists or is hard-deleted, with no archived state.
2. WHEN an active registered user creates a Space, the service MUST atomically add the creator as its first active `ADMIN`.
3. The creator MUST NOT hold permanent ownership beyond that role.
4. WHEN a caller views Space metadata, members, or feed, the service MUST require active membership.
5. WHEN a caller updates Space metadata, the service MUST require the Space `ADMIN` role.
6. WHEN a caller invites, lists invitations, or revokes one, the service MUST require the Space `ADMIN` role.
7. WHEN a caller removes another member or changes an accepted member's role, the service MUST require the Space `ADMIN` role.
8. A member MAY leave a Space.
9. WHEN a caller hard-deletes a Space, the service MUST require the Space `ADMIN` role.
10. `ListSpaces` MUST return only Spaces in which the caller has active membership; no instance-wide Space listing exists.
11. Membership-authorized responses MUST include the caller's role and the accepted-member count.
12. Metadata-only Space summaries, such as an invitation's, MUST carry the default role and count values.
13. The Space API MUST NOT offer an operation for a Space `ADMIN` to move, withdraw, or otherwise mutate an individual memo.
14. An application `ADMIN` MUST NOT become an implicit Space member for Space browsing or governance.

Invitations and membership
15. WHEN a Space `ADMIN` invites a user, the service MUST require an existing active registered user and a role of `ADMIN` or `USER`.
16. The service MUST let exactly the invited user accept or decline an invitation.
17. WHEN the invitee accepts, the store MUST atomically change the row from `INVITED` to `ACTIVE`, keeping the role chosen at invitation.
18. WHEN the invitee declines or an administrator revokes, the store MUST delete only the `INVITED` row.
19. WHEN an invitation is declined or revoked, the service MUST permit a later invitation for the same Space-user pair.
20. The Space service MUST NOT offer any operation that directly creates an active membership.
21. A received invitation MUST carry a read-only Space summary without granting `GetSpace` access.
22. A request for a Space-user pair MUST always refer to its current pending invitation; no invitation-generation UID exists.
23. WHEN an invitation is created, the service MUST deliver a `SPACE_INVITATION` inbox notification, with email dispatch when email is enabled.
24. WHEN the invitee accepts, the service MUST archive the notification and keep it as history while the membership is active.
25. WHEN the invitation is declined or revoked, the service MUST delete the notification.
26. WHEN a notification is read, the service MUST omit it unless the receiver holds the pending invitation or is an active member.
27. The invitee MAY accept or decline from the Inbox.

Lifecycle and deletion
28. WHEN a member leaves or is removed, the service MUST NOT move or delete their memos.
29. WHILE a removed author's memo stays assigned, the policy MUST grant that author only the reads its audience permits.
30. WHILE such a memo stays assigned, the author MAY delete it, withdraw it, or move it to a Space where they are active.
31. WHILE such a memo stays assigned, the service MUST reject every other mutation by that author.
32. WHEN one memo is deleted, the store MUST delete its owned resources and relations having it as an endpoint, and no other memo.
33. WHEN a Space is hard-deleted, the store MUST atomically delete it, its memberships, directly assigned memos and their owned rows, and relations to them.
34. Space deletion MUST NOT follow relations into other Spaces or Unassigned memos.
35. Space deletion MUST NOT delete inbox records.
36. The service MUST NOT give the deleting `ADMIN` a content inventory of memos they cannot read.
37. WHEN a Space deletion commits, the service MUST clean external attachment objects through the existing post-commit path.
38. IF the user has any active Space membership, THEN the store MUST fail user hard deletion, even with `force` set.
39. WHEN a user is deleted, the store MUST remove their pending invitations in the account-deletion transaction.
40. Account deletion MUST remove only inbox rows whose sender or receiver is that user.

Persistence and concurrency
41. The migration `0.31` MUST ship for SQLite, MySQL, and PostgreSQL with equivalent fresh-install schemas.
42. The migration MUST backfill existing membership rows to `ACTIVE`.
43. The migration MUST keep existing memos Unassigned with UID, author, visibility, relations, and permalink unchanged.
44. The migration MUST NOT rewrite comment rows or comment visibility.
45. The migration MUST NOT create a default Space; SQLite rebuilds affected tables where its `ALTER TABLE` support requires.
46. On MySQL and PostgreSQL, operations creating or activating a Space relationship MUST serialize with user deletion on the target user row.
47. On MySQL and PostgreSQL, invitation creation MUST serialize with Space deletion on the Space row.
48. On SQLite, every store transaction MUST begin `IMMEDIATE`.
49. The store MUST use ordinary transactions for Space, invitation, membership, placement, audience, comment, memo-deletion, and Space-deletion writes.

UI and MCP
50. The web app MUST scope Home, Explore, and attachment lists to the active Space.
51. The web app MUST keep Archived, Inbox, and user profiles user-global; their routes do not inherit the active Space.
52. Global Settings MUST provide a Spaces section for received invitations, joined Spaces, metadata, members, roles, and pending invitations.
53. MCP MUST expose the Space service as `space_*` tools running in-process against the same REST bindings.

## Constraints & Invariants
- Global Settings is a management surface, not another Space switcher.
- Invariant: every Space retains at least one active `ADMIN`; a pending `ADMIN` invitation does not count.
- Invariant: one unique Space-user row holds the current relationship slot; `status` is required, has no default and no database `CHECK`.
- Invariant: an invitation is never membership; apart from its Space summary it grants no metadata, feed, memo, participation, or governance access.
- Invariant: every membership authorization requires `status = ACTIVE` and role `ADMIN` or `USER`.
- The initial version records no inviter, invitation, Space, or membership timestamps and adds no cleanup queue, transaction retries, or concurrency framework.
- Nullable `memo.space_id` enforces zero-or-one placement; existing `memo_relation` rows stay the source of truth for comments.

## Failure Behavior
1. IF a membership change or user archival would leave a Space without an active `ADMIN`, THEN the service MUST reject it.
2. IF an authenticated non-member, including a pending invitee, requests Space metadata, members, or feed, THEN the service MUST return `NotFound`.
3. IF a stored `status` is unknown, THEN authorization queries MUST deny access.
4. IF user hard deletion meets an active Space membership, THEN the service MUST fail the deletion, and `force` MUST NOT bypass this rule.
5. IF the Space is deleted or the offer revoked, THEN the invitation notification MUST leak no Space metadata.
6. IF post-commit attachment cleanup fails, THEN the service MUST return an error while the Space deletion stays committed; no retry queue exists.

## Conformance
An implementation is conformant when it satisfies behaviors 1–53, holds every invariant, and follows the failure rules (@store/test/space_test.go, @store/test/space_delete_test.go, @store/test/space_concurrency_test.go, @store/test/user_delete_test.go, @server/api/v1/space_service_test.go).
Given user U holds an `INVITED` `ADMIN` row in Space S,
When U calls `GetSpace` for S,
Then the service returns `NotFound` until U accepts.
