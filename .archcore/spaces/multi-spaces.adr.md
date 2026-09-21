---
title: "Multi-spaces collaboration"
status: draft
tags:
  - "spaces"
---

## Context
Status: Accepted (2026-08-23).
Memos needs shared collaboration contexts without turning each context into a tenant or transferring memo authorship. The decision separates placement, audience, authorship, distribution, and relation context; @core/access/memo.go and @store/space.go implement that boundary. Its 2026-09-17 revision grants application administrators named-memo superuser access without implicit Space membership.

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

## Decision
Represent each Space as a flat instance-scoped collaboration resource with accepted memberships, consent-based invitations, optional single-Space memo placement, independent memo audiences, and explicit aggregate hard deletion.

## Decision Details
Every memo remains author-owned, including comments. Unassigned is real absence represented by nullable `memo.space_id`; existing identities, audiences, relations, and permalinks survive migration without creating a default Space.
Space membership has `ADMIN`/`USER` roles and `INVITED`/`ACTIVE` state in one unique Space-user slot. Only the invitee accepts a pending role; invitations grant no membership privileges, and decline/revoke permits later reinvitation.
Creation gives the creator the first active admin without establishing permanent ownership. Membership changes and archival preserve at least one active admin.
The memo's audience alone controls ordinary reads: private author, authenticated instance users, public readers subject to instance policy, or active members for `SPACE`. Space placement is not an extra ordinary read gate.
Space metadata/membership/feed browsing requires active membership; readable assigned public/protected memos do not disclose Space metadata to non-members. Unexpired bearer shares cover one exact memo only.
Application administrators bypass memo-local checks for named operations and child resources, but structural validity remains binding. Lists/counts/feeds retain ordinary audience predicates, and administrators gain no implicit Space governance.
Participation in assigned content normally needs membership as well as memo access. Authors control content, audience, placement, and owned lifecycle; Space admins control metadata, invitations, membership, and aggregate deletion rather than individual memo mutation.
Authors who leave can delete, withdraw, or move their memos without source membership; target placement needs active membership. Other mutations remain unavailable while assignment persists.
Moving a `SPACE` memo explicitly confirms the new audience via both update-mask fields; withdrawing it supplies a non-Space audience atomically. Active shares and `SPACE` visibility exclude one another.
Comments are independent memos with immutable non-owning context relations; relations neither inherit authorization nor propagate deletion. Conversation queries authorize context first, then each reply. Relation/snippet exposure needs both endpoints; unreadable parent identity does not grant access.
Space deletion atomically removes directly assigned memos and owned database rows without following cross-Space/Unassigned relations; external files use post-commit cleanup. Membership loss does not move or delete memos.
User deletion fails with any active Space membership even with force; pending invitations do not block it. Inbox records have independent retention and are filtered when required subjects are unreadable or missing.
The Space service separates invitations from memberships and offers no direct creation of active membership. Visibility keeps its v1 wire name and adds `SPACE=4`; numeric ordering has no authorization meaning.
Space placement filters narrow the ordinary read predicate rather than widening it. MCP uses the same API policy. Home/Explore/attachments follow active Space; Archived/Inbox/profiles remain user-global.
Subject-free live-refresh events invalidate caches; clients refetch through authorization. Prepared email/webhook deliveries are authorized before enqueueing, with no cancellation when access changes while queued.

## Alternatives Considered
- **Tenant, general group, nested folder, or multi-placement label:** rejected because the selected resource is one flat collaboration context.
- **Placement-derived audience or a second membership read gate:** rejected because ordinary reads and participation are separate concerns.
- **Placement join table, nested memo names, or default Space:** rejected because nullable placement preserves stable identities and genuine absence.
- **Parent/root ownership columns or inherited thread policy:** rejected because each comment remains an independently authorized memo.
- **Mutable comment context, forced equal placement, or cascading individual deletion:** rejected because relations are immutable and non-owning.
- **Archive, reject non-empty deletion, or unassign on deletion:** rejected for the initial version in favor of explicit directly-assigned aggregate hard deletion.
- **Follow relations during Space deletion:** rejected because relations cannot extend deletion to unrelated placement contexts.
- **Move/delete a departing member's memos:** rejected because contributions remain until author lifecycle action or Space deletion.
- **Space-admin individual-memo eviction:** rejected because placement belongs to memo-author lifecycle, not Space governance.
- **Implicit Space access for application admins:** revised to named-memo superuser access on 2026-09-17, preserving ordinary collection browsing and membership governance.
- **Admin-created active memberships:** rejected because only invitee acceptance supplies consent.
- **Separate invitation table:** rejected for this iteration because the unique relationship slot covers current state without history, expiry, or credentials; revisit when those requirements appear.
- **Rename or duplicate v1 visibility:** rejected because the existing field preserves API compatibility with domain Audience.

## Consequences
### Positive
- Users can participate in multiple Spaces without changing memo identity or authorship.
- Invitations preserve explicit consent; public/instance audiences retain independent direct-read behavior.
- Aggregate deletion has an explicit boundary limited to directly assigned content.
### Tradeoffs
- Read access does not imply participation or Space browsing; policy consumers need both distinctions.
- A departed author may retain lifecycle authority without ordinary read access to Space-only content.
- External attachment cleanup remains best effort after commit; no retry queue is introduced.
- Broader concurrent membership/placement/memo hardening and queued-delivery cancellation remain deferred.

## Deferred Work
Guests/external invitations, invitation expiry/history/attribution, open enrollment, account erasure beyond the guard, retention/preferences, collaborative editing, audits, soft deletion/restoration, retryable cleanup, and asynchronous deletion of very large Spaces remain out of scope. Later work must preserve invitee consent, independent memo authorization, non-propagating relations, and explicit Space aggregate deletion unless this design is revisited.
