# Architecture Decision Records

Architecture Decision Records (ADRs) document significant technical and product decisions whose rationale should remain available after the related
implementation work is complete.

## Index

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-tag-syntax-and-recognition.md) | Tag Syntax and Recognition | Accepted | 2026-08-01 |
| [0002](0002-username-format-and-references.md) | Username Format and References | Accepted | 2026-08-02 |

## Conventions

- Name files `NNNN-short-kebab-case-title.md`, using a four-digit number that is never reused.
- Assign the next number when an ADR is opened, even if an earlier ADR is later rejected or superseded.
- Use the title `# ADR NNNN: Title` and record dates as `YYYY-MM-DD`.
- Keep accepted ADRs as historical records. Replace a decision with a new ADR rather than rewriting the original rationale.
- When one ADR replaces another, add `Supersedes: ADR NNNN` to the new ADR and `Superseded by: ADR NNNN` to the old ADR.

## Statuses

- **Proposed**: Under discussion; unresolved questions may remain.
- **Accepted**: Approved as the decision to implement and maintain.
- **Rejected**: Considered but not selected.
- **Superseded**: Replaced by a later ADR.

## Suggested structure

Each ADR should contain enough information to understand the decision without reconstructing the original discussion:

```markdown
# ADR NNNN: Title

Status: Proposed

Date: YYYY-MM-DD

## Context

## Decision drivers

## Decision

## Consequences

## Alternatives considered

## Open questions before acceptance

## References
```

Optional sections may be omitted when they do not add useful context.

## Process

1. Create a `Proposed` ADR with the next available number and add it to the index.
2. Discuss the proposal with maintainers, updating the ADR as the decision develops.
3. Change the status to `Accepted` or `Rejected` when the outcome is clear.
4. If an accepted decision changes materially, create a new ADR and cross-link the superseding records.
