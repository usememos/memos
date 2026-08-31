# Multi-Spaces Design

Status: Accepted

Date: 2026-08-23

Existing domain language: [Memos context](../../CONTEXT.md)

## Summary

Multi-Spaces adds shared collaboration contexts inside one Memos instance. A Space groups members and memos, but it is not a tenant or workspace boundary.

Every memo remains an author-owned, independent resource. Placement, audience, authorship, distribution, and relation context are separate. Memo authors control placement through the existing memo update API. Space governance controls the Space, its membership, and the aggregate deletion of directly assigned memos; it does not transfer authorship or grant collaborative editing rights.

## Goals

- Let an active user create or join multiple Spaces.
- Give each Space accepted `ADMIN` and `USER` memberships.
- Let a Space `ADMIN` invite an existing active Memos user with a selected role, while requiring that user to accept before becoming a member.
- Let members contribute and browse memos in a shared Space context.
- Let every memo, including a comment, be Unassigned or assigned to exactly one Space while retaining its own author, audience, and lifecycle.
- Add a Space-members-only memo audience.
- Preserve existing memo identities, relations, data, and non-Space workflows.
- Keep existing memos Unassigned; do not create a default Space.
- Provide a complete backend workflow for Space creation, invitations, membership, memo placement, and Space browsing.

## Non-goals

- Tenant isolation, per-Space authentication, or per-Space instance settings.
- Multiple or nested Space placement, folders, or replacement of tags and saved views.
- Space ownership of memos, shared authorship, or collaborative editing.
- Space-admin mutation or moderation of an individual memo, including changing its placement.
- Thread ownership, inherited placement or audience, or relation-based cascading deletion.
- Mutable or re-parentable `COMMENT` relations.
- Space archival or restoration.
- Guests, email or external-user invitations, open enrollment, federation, or public Space discovery.
- A generated default Space.
- Re-scoping user-global surfaces such as Inbox and user profiles around a Space.

## Research

Research completed on 2026-08-22 compared the agreed boundary with Discourse Categories and Groups, Notion Teamspaces, and Mastodon.

| Product | Useful model | What Memos should avoid |
| --- | --- | --- |
| Discourse | Posts retain their authors while a topic has one category and group permissions control access. | Separate Group, Category, and moderator concepts for one collaboration area; nested categories; default-open access. |
| Notion | Teamspaces are first-class membership and navigation contexts, and pages can move between personal and shared areas. | Mandatory default Teamspaces, shared page ownership, page trees, and layered permission inheritance. |
| Mastodon | A post's author, visibility, and feed distribution are independent. | Treating personal Lists or follows as shared membership, coupling audience to feed placement, or importing federation concerns. |

The research supports four choices:

- Make Space one first-class resource with explicit membership and roles, gated by invitee acceptance.
- Keep placement, audience, authorship, and distribution independent.
- Represent Unassigned as a real absence of placement.
- Make Spaces visible in normal browsing, creation, and management flows while keeping user-global surfaces independent of the current Space.

Sources: [Discourse category permissions](https://meta.discourse.org/t/understanding-groups-and-category-permissions/87678), [Discourse post ownership](https://meta.discourse.org/t/changing-ownership-of-posts/276672), [Notion Teamspaces](https://www.notion.com/help/intro-to-teamspaces), [Notion sharing and permissions](https://www.notion.com/help/sharing-and-permissions), [Mastodon post visibility](https://docs.joinmastodon.org/user/posting/), and [Mastodon Lists](https://docs.joinmastodon.org/entities/List/).

These sources establish product mechanics, not demand or prevalence. This research did not include Memos analytics, user interviews, or usability testing.

## Proposed design

### Core model

- A Space is an instance-scoped collaboration resource, not a tenant, group, folder, or memo author. It exists or is hard-deleted; there is no archived state.
- A memo keeps its `memos/{uid}` identity and author. Its placement is either Unassigned or one Space.
- Placement, audience, authorship, distribution, and relation context do not imply one another.
- Audience is a single choice: Author, Instance, Space, or Public. These are named domains, not ordered access levels.
- A comment is an independent memo connected to a context memo by one immutable `COMMENT` relation created atomically with it. The relation grants no ownership, inheritance, or lifecycle authority.
- A reaction belongs to one memo and has no independent audience.
- A Space invitation is a pending offer to one existing active registered user with a selected `ADMIN` or `USER` role. It grants no Space access before that user accepts it.
- A Space membership is an accepted relationship between one active registered user and one Space with role `ADMIN` or `USER`. The creator becomes the first `ADMIN`; there is no permanent owner.
- Application `ADMIN` is a control-plane role and is not an implicit Space member or memo reader.

### Read access and distribution

The v1 API calls a memo's audience `visibility` for compatibility. Ordinary identity-based read access is defined only by this table:

| Visibility | Readers |
| --- | --- |
| `PRIVATE` | The active authenticated author. |
| `PROTECTED` | Active authenticated users. |
| `PUBLIC` | Active authenticated users, plus anonymous callers when instance policy permits. |
| `SPACE` | Active members of the assigned Space. It is invalid for an Unassigned memo. |

Space placement adds no additional read gate. In particular, an active non-member may directly read an assigned `PROTECTED` or `PUBLIC` memo, and anonymous access to an assigned `PUBLIC` memo follows instance policy. Such access does not reveal Space metadata, membership, or the Space feed. A memo's Space reference is returned only to its author or an active member.

An unexpired bearer share is an explicit capability exception for one exact memo. It does not grant list, feed, Space, or related-memo access.

Distribution is derived rather than separately configured:

- Global feeds return readable memos that do not have a `COMMENT` relation.
- A Space feed first requires active membership, then returns readable memos assigned to that Space that do not have a `COMMENT` relation. Membership does not make another author's assigned `PRIVATE` memo readable.
- Direct memo reads evaluate each memo independently, including comments.
- A comment or conversation query requires its context memo to be readable, then filters every replying memo by that memo's own audience.
- A `COMMENT` or `REFERENCE` relation and its snippet are returned only when both endpoints are readable.
- Reactions are readable whenever their memo is readable.
- Public profiles and other public surfaces continue to use `PUBLIC`, not Space placement.

### Participation and governance

Reading and participation are separate. A caller may read an assigned `PUBLIC` or `PROTECTED` memo without membership, but participation in assigned content requires active membership.

| Action | Required authority |
| --- | --- |
| Create a Space | Any active registered user; creation atomically adds the first `ADMIN`. |
| View Space metadata, members, or feed | Active Space membership. |
| Update Space metadata | Space `ADMIN`. |
| Invite an existing active user, choose their role, list invitations, or revoke one | Space `ADMIN`. |
| Accept or decline an invitation | Exactly the invited user. |
| Remove another member or change an accepted member's role | Space `ADMIN`; the Space must always retain an active `ADMIN`. |
| Leave a Space | The member; leaving must preserve an active `ADMIN`. |
| Create or assign a memo in a Space | The author is an active member of the target Space. |
| Comment on or react to an assigned memo | The caller can read the memo and is an active member of its Space. The new comment is authorized independently as a new memo. |
| Edit content or audience; manage attachments, references, or shares | Memo author; if assigned, the author is also an active member of its Space. |
| Delete one memo | Memo author. This does not delete another memo. |
| Withdraw or move a memo | Memo author. Source membership is unnecessary; target membership is required. |
| Hard-delete a Space | Space `ADMIN`. |

Any membership change or user archival that would leave a Space without an active `ADMIN` is rejected.

An invitation is never treated as membership. Apart from the read-only Space summary carried by the invitation itself, a pending `ADMIN` invitation grants no Space metadata, feed, memo, participation, or governance access and does not count toward the last-active-`ADMIN` invariant. Accept preserves the role selected when the invitation was created. Decline and administrator revocation remove the pending offer; either outcome permits a later invitation for the same Space-user pair.

Only the memo author changes placement, using the existing memo update API to assign, move, or withdraw it. Assigning a memo does not change its audience. Changing placement and audience may be one atomic update. Moving a `SPACE` memo requires both `space` and `visibility` in the update mask, with visibility set to `SPACE`, to confirm the new member audience. Withdrawing one requires a non-Space audience in the same update.

Creating a share for a `SPACE` memo is rejected. Changing a memo with active shares to `SPACE` is rejected until those shares are revoked.

### Lifecycle

Leaving or removing a member does not move or delete their memos. A removed author reads them only when their audience permits, so they cannot read a `SPACE` memo in the former Space. They retain narrow author lifecycle authority to delete it, withdraw it, or move it to a Space where they are active, but cannot otherwise mutate it while it remains assigned.

Deleting one memo deletes that memo, its owned resources, and relations having it as an endpoint. It does not traverse relations or delete other memos. Inbox records are independent and are not deleted because their payload references a deleted memo; notification surfaces omit a complete notification when its required memo is missing or unreadable.

Hard-deleting a Space atomically deletes the Space, its memberships, every directly assigned memo, those memos' owned database resources, and relations having a deleted endpoint. It does not follow relations into other Spaces or Unassigned memos, and it does not delete inbox records. The deleting `ADMIN` receives no content inventory for memos they cannot read. External attachment objects use the existing post-commit cleanup path; this feature adds no cleanup queue or dispatcher.

General account erasure remains deferred. As a fail-closed guard, user hard deletion fails while the user has any active Space membership, and `force` does not bypass this rule. Pending invitations do not block deletion and are removed in the account-deletion transaction. Account deletion removes only inbox rows whose sender or receiver is that user; deleting the user's memos does not remove other inbox rows that reference them.

### Persistence and migration

```text
space(id, uid, title, description)
space_member(space_id, user_id, status INVITED | ACTIVE, role ADMIN | USER)
memo(..., space_id NULL means Unassigned, visibility encodes audience)
memo_relation(memo_id, related_memo_id, type COMMENT | REFERENCE)
```

The Space-user pair is unique and represents one current relationship slot. `INVITED` is exposed as a Space Invitation; `ACTIVE` is exposed as a Space Membership. Accept atomically changes the current row from `INVITED` to `ACTIVE`; decline and revoke delete only `INVITED` rows. There is deliberately no invitation-generation UID, so a request for the same Space-user pair always refers to its current pending invitation.

`status` is required and has no default or database `CHECK`; Store logic writes and recognizes `INVITED` and `ACTIVE`, while unknown values fail closed in authorization queries. The existing role constraint remains unchanged. The initial version does not record inviter, invitation, Space, or membership timestamps; they can be added when a concrete attribution, expiration, audit, or ordering requirement exists. A nullable `memo.space_id` directly enforces zero-or-one placement; an association table is unnecessary. Existing `memo_relation` rows remain the source of truth for comments.

The change ships in migration `0.31` for SQLite, MySQL, and PostgreSQL, with equivalent fresh-install schemas. Existing membership rows are backfilled to `ACTIVE`. Existing memos keep their UID, author, visibility, relations, permalink, and become Unassigned. Comment rows and comment visibility are not rewritten. SQLite rebuilds the affected tables where its `ALTER TABLE` support requires it.

Space creation, invitation transitions, membership changes, placement and audience changes, comment creation, memo deletion, and Space deletion use ordinary transactions where partial application would corrupt directly affected data. On MySQL and PostgreSQL, operations that create or activate a Space relationship serialize with user deletion on the target user row, and invitation creation serializes with Space deletion on the Space row. This prevents a concurrent delete from leaving an orphaned active membership or invitation. Space deletion directly removes assigned memos and their owned rows in the same style as existing user deletion, then uses the existing best-effort attachment storage cleanup after commit. The initial version does not introduce general transaction retries, a cleanup queue, or a global concurrency framework.

### API shape

A dedicated Space service provides create, list, get, update, and hard-delete operations, active-member read/update/delete operations, and a distinct Space Invitation resource. Invitation operations cover create, list by Space, list received by user, get, revoke, accept, and decline. There is no operation that directly creates an active membership. A received invitation includes a read-only Space summary so the invitee can understand the offer without receiving membership-based `GetSpace` access.

Listing Spaces returns only Spaces in which the caller has active membership; no application-wide Space listing or archive API is added. An authenticated non-member, including a pending invitee, receives `NotFound` for Space metadata, members, and feed requests.

Space responses returned through membership-authorized operations include the authenticated user's membership role and the accepted-member count as output-only projections. Metadata-only Space summaries, such as the summary carried by an invitation, use the default role and count values.

Memo responses gain an optional Space resource name, and `Visibility` adds `SPACE = 4` without renumbering existing values. The domain-to-v1 mapping is Author to `PRIVATE`, Instance to `PROTECTED`, Public to `PUBLIC`, and Space to `SPACE`. `VISIBILITY_UNSPECIFIED` remains an input sentinel: create treats it as `PRIVATE`, an explicit visibility update rejects it, and responses never return it. Visibility values are named domains and must not be compared numerically. The global default memo visibility setting continues to accept only `PRIVATE`, `PROTECTED`, and `PUBLIC`, because it cannot identify a Space.

Memo listing gains explicit all-readable, Unassigned, and Space scopes. Space scope requires active membership. Existing global and Space feeds exclude comments by default, and Space identity is not added to the CEL filter schema.

Placement and audience use the existing memo update mechanism so the memo author can change them atomically. The Space API does not add an operation for an `ADMIN` to move, withdraw, or otherwise mutate an individual memo.

MCP memo operations reuse the same memo policy; Space management is not exposed through MCP in the initial version.

### UI shape

The active Space scopes collaborative resource browsing and creation, including Home, Explore, and attachment lists. Archived, Inbox, and user profiles remain user-global and their routes do not inherit the active Space. Global Settings provides a Spaces section for viewing received invitations and managing joined Spaces, metadata, members, roles, and pending invitations; it is a management surface rather than another Space switcher.

### Security invariants

Before `SPACE` can be stored, one shared, memo-local, fail-closed policy must cover point reads, lists and counts, files, reactions, relations, notifications, email, webhooks, shares, search, statistics, public feeds, and MCP. Child resources resolve the memo they directly belong to. Application `ADMIN` receives no implicit bypass.

Unknown visibility denies access. A missing or invalid placement denies `SPACE` reads and placement-dependent operations. Other audiences continue to govern ordinary reads, but an invalid Space identity is omitted. Inactive users, pending invitations, unknown relationship states, and invalid membership roles deny any access that depends on them. Every membership authorization requires `status = ACTIVE` and role `ADMIN` or `USER`. Where the database supports row locks, relationship creation and activation serialize against user deletion, and invitation creation serializes against Space deletion. Database list and count authorization is applied before pagination:

```text
PRIVATE + active authenticated author
OR PROTECTED + active authenticated caller
OR PUBLIC permitted for caller
OR SPACE + active membership in memo.space_id
```

CEL filters may only narrow this predicate. Space membership is checked per request or through immediately invalidated cache state. Write paths validate membership and placement as part of their ordinary operation. Missing or unreadable notification subjects and relation endpoints fail closed without leaking partial metadata. Broader serialization between concurrent membership, placement, and memo mutations remains deferred.

Live refresh is an authenticated, subject-free cache-invalidation channel. Successful memo and reaction mutations broadcast `{"type":"memo.changed"}`; successful Space, invitation, and membership mutations broadcast `{"type":"space.changed"}`. Neither event carries a resource name, audience, actor, invitation, or membership data. Clients invalidate the corresponding Space- and memo-backed caches and refetch through ordinary authorization. SSE does not materialize recipient sets or perform memo-level authorization.

Notifications are authorized when presented. Email and user webhook payloads are authorized before entering the existing asynchronous queue; the initial version does not cancel a prepared delivery when access changes while it is queued. A comment webhook requires both the comment and its context memo to be readable by the webhook owner when the event is prepared. A deleted-memo webhook is built only from an author-readable pre-delete snapshot.

Files for `PRIVATE`, `PROTECTED`, and `SPACE` memos use `private, no-store`; public files may use revalidation.

## Alternatives considered

| Alternative | Decision |
| --- | --- |
| Make Space a tenant, general Group, nested folder, or multi-placement label | Rejected; Space is one flat collaboration context inside an instance. |
| Derive audience from placement or add membership as a second read gate | Rejected; the memo audience alone defines ordinary reads, while membership separately controls Space browsing and participation. |
| Use a placement association table, nested memo names, or a default Space | Rejected; nullable `memo.space_id` preserves stable memo identity and a real Unassigned state. |
| Replace relations with parent/root columns or inherit thread placement, audience, or lifecycle | Rejected; every comment is an independent memo and no canonical thread participates in authorization. |
| Allow `COMMENT` mutation, require comments to share placement, or cascade individual deletion | Rejected; comment context is immutable and non-owning, and both endpoints remain independent. |
| Archive Spaces, reject non-empty deletion, or automatically unassign their memos | Rejected for the initial version; hard deletion has an explicit aggregate lifecycle for directly assigned memos. |
| Follow relations during Space deletion | Rejected; relations cannot extend deletion into other Spaces or Unassigned content. |
| Move or delete a member's memos when membership ends | Rejected; historical contributions remain until an author lifecycle action or Space deletion. |
| Give a Space `ADMIN` a separate operation to evict or otherwise mutate one memo | Rejected; placement belongs to the memo author's lifecycle, while Space governance is limited to Space metadata, membership, and aggregate hard deletion. |
| Give application `ADMIN` implicit Space or memo access | Rejected; moderation and recovery require separate control-plane design. |
| Let a Space `ADMIN` directly create an active membership | Rejected; only the invited user can turn a pending offer into membership. |
| Add a separate invitation table now | Rejected for this iteration because the relationship state fits the unique Space-user slot and the design intentionally omits history, expiration, and delivery credentials. Revisit when those requirements appear. |
| Rename v1 `visibility` to `audience`, or expose both fields | Rejected; the domain term is Audience, while one legacy v1 field remains the compatibility representation. |

## Deferred design

Email and external-user invitations, invitation expiration, inviter attribution, invitation history, open enrollment, account erasure beyond the membership guard, notification delivery and retention policy, application-admin moderation and recovery, audit history, soft deletion, restoration, retryable external-object cleanup, delivery-time cancellation of queued email/webhooks, broader concurrent-mutation hardening, and asynchronous deletion of very large Spaces remain deferred. Later work must preserve invitee consent, independent memo authorization, non-propagating relations, and explicit Space aggregate deletion unless this design is revisited.
