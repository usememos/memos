# ADR 0003: Space UID Allocation and Format

Status: Accepted

Date: 2026-08-27

Domain glossary: [Memos domain glossary](../glossary.md)

## Context

A Space title is mutable and non-unique. Using it alone in switchers, settings, badges, and destructive confirmations makes distinct Spaces with the same
title difficult to tell apart. The immutable public identity is instead the instance-wide UID embedded in the resource name `spaces/{space UID}`.

Previously, first-party clients omitted the UID and the server generated a short UUID. That prevented clients from choosing a stable identifier before
creation and made the default differ from other newer UUID-backed identities. Existing clients may still omit the request field, and existing short UIDs
must remain valid without a data migration.

## Decision drivers

- Give clients a stable identifier before they issue a create request.
- Keep old clients and existing Space resource names compatible.
- Reuse the established public-resource UID grammar instead of introducing a Space-only slug format.
- Keep the complete immutable UID discoverable in Settings without adding identity metadata to every compact Space label.

## Decision

The first-party client generates a canonical lowercase UUID v4 for every new Space and sends it in `CreateSpaceRequest.space_id`. It may expose that value
before creation and let the user replace it with a custom UID. A retry of the same create interaction reuses the same generated value.

The API field remains optional for compatibility. When it is empty, the server generates a canonical lowercase UUID v4. A supplied value uses the shared
public-resource grammar:

```text
SpaceUID     := Alphanumeric
              | Alphanumeric UIDCharacter{0,34} Alphanumeric
UIDCharacter := Alphanumeric | "-"
Alphanumeric := ASCII letter | ASCII digit
```

The UID is therefore 1 through 36 characters. Consecutive interior hyphens, uppercase letters, and digits-only values are valid. The one-character
minimum matches the other public-resource UIDs; increasing it would not materially prevent collisions or name claiming. The spelling is preserved.

The UI uses the title as the primary label. Settings surfaces and their management subflows always show the complete UID with an explicit `Space UID`
label. Other surfaces show the UID only when two known Spaces have exactly matching, case-sensitive titles, or when the title is unavailable and the UID
is the only usable identity. When compact identity metadata is needed, canonical UUIDs use an eight-character prefix; short custom UIDs are shown in
full, while long custom UIDs show both ends so late differences remain visible. Accessible labels and tooltips retain the complete UID in those cases.

Existing Space UIDs remain readable and are not rewritten.

## Consequences

- New first-party creates use UUID v4 by default, while custom identifiers remain concise and human-readable when desired.
- Old clients continue to work through the server fallback.
- Duplicate titles remain allowed and require no rename or uniqueness migration.
- Compact Space labels stay title-only until a matching title or missing-title fallback makes the UID necessary.
- UID collisions are rejected by the existing instance-wide uniqueness constraint.
- Case-preserving UID input is accepted. Aligning exact-case uniqueness and lookup across database collations is a separate schema decision.

## Alternatives considered

- **Require unique titles.** Rejected because titles are display labels and users may legitimately reuse them.
- **Always show UIDs across the UI.** Rejected because it makes a technical identifier compete with the human-readable title even when no ambiguity exists.
- **Only show UIDs in Settings.** Rejected because matching titles would remain ambiguous in switchers, badges, and scoped search.
- **Keep server-only allocation.** Rejected because the first-party client cannot retain one identity across retries or offer customization before creation.
- **Require a longer custom UID.** Rejected because length does not meaningfully solve collision or namespace-claiming concerns.
