---
title: "Space UID allocation"
status: draft
tags:
  - "spaces"
---

## Context
Status: Accepted (2026-08-27).
Space titles are mutable and non-unique, so equal titles cannot identify a Space in settings or destructive confirmations. The stable resource identity is its instance-wide UID, while older clients can omit that UID; allocation appears in @server/api/v1/space_service.go and @web/src/components/CreateSpaceDialog.tsx.

## Decision
Adopt client-generated lowercase UUID v4 Space UIDs with a server UUID v4 fallback, shared case-preserving public-resource grammar, and context-dependent identity labels.

## Decision Details
The client allocates a UUID before creation and sends `CreateSpaceRequest.space_id`; the same create interaction retains that value across retries and can allow customization before submission.
An omitted API field remains valid and triggers server generation. Custom values contain 1–36 ASCII letters, digits, and interior hyphens, with alphanumeric ends; one-character, digits-only, uppercase, and repeated-interior-hyphen values are valid.
Spelling is preserved. Existing short UIDs remain readable without rewriting or a data migration.
The title is the primary UI label. Settings and their management subflows show the complete value labelled `Space UID`.
Other surfaces show identity metadata only for exactly matching case-sensitive titles among known Spaces, or when a missing title leaves the UID as the usable identity.
Compact canonical UUID labels use eight-character prefixes. Short custom UIDs appear in full; long custom UIDs show both ends. Accessible labels and tooltips retain the complete UID (@web/src/lib/space-display.ts).
Instance-wide uniqueness rejects collisions; cross-database collation alignment for exact-case UID uniqueness is a separate schema decision.

## Alternatives Considered
- **Unique titles:** rejected because titles are display labels users can legitimately reuse.
- **UIDs everywhere:** rejected because a technical identifier competes with an unambiguous human-readable title.
- **UIDs only in Settings:** rejected because duplicate titles stay ambiguous in switchers, badges, and scoped search.
- **Server-only allocation:** rejected because clients cannot retain a preselected identity across retries or customize it before creation.
- **Longer minimum custom UID:** rejected because length does not resolve collisions or namespace claiming.

## Consequences
### Positive
- Clients can choose identity before issuing a request; old clients retain the omitted-field fallback.
- Duplicate titles remain allowed without renaming or a uniqueness migration.
- Existing Space resource names are unchanged.
### Tradeoffs
- Compact labels need ambiguity detection and a complete accessible identity.
- Case-preserving custom UIDs leave database-collation alignment as a separate concern.
