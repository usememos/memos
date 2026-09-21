---
title: "Decision record conventions"
status: draft
tags:
  - "conventions"
---

## Rule
1. For ADR files in `docs/adr/`, authors MUST use the name `NNNN-short-kebab-case-title.md` with a four-digit number.
2. For ADR numbers in `docs/adr/`, authors MUST NOT reuse a number.
3. When opening an ADR in `docs/adr/`, authors MUST assign the next number, even if an earlier ADR is later rejected or superseded.
4. For ADR titles in `docs/adr/`, authors MUST use the form `# ADR NNNN: Title`.
5. For dates in `docs/adr/` ADRs, authors MUST use the `YYYY-MM-DD` format.
6. For accepted ADRs in `docs/adr/`, authors MUST keep the file as a historical record.
7. When replacing a decision recorded in `docs/adr/`, authors MUST write a new ADR instead of rewriting the original rationale.
8. When one ADR replaces another, authors MUST add `Supersedes: ADR NNNN` to the new ADR.
9. When one ADR replaces another, authors MUST add `Superseded by: ADR NNNN` to the old ADR.
10. For ADR content in `docs/adr/`, authors SHOULD record enough to understand the decision without reconstructing the original discussion.
11. For ADR layout in `docs/adr/`, authors SHOULD follow the suggested structure in the Good example below.
12. When an optional section of a `docs/adr/` ADR adds no useful context, authors MAY omit it.
13. When creating an ADR in `docs/adr/`, authors MUST set its status to `Proposed`.
14. When creating an ADR in `docs/adr/`, authors MUST add it to the index table in `docs/adr/README.md`.
15. While a `Proposed` ADR is under discussion, authors MUST discuss it with maintainers and update it as the decision develops.
16. When the outcome of a `Proposed` ADR is clear, authors MUST change its status to `Accepted` or `Rejected`.
17. When an accepted decision changes materially, authors MUST create a new ADR and cross-link the superseding records.

## Rationale
ADRs keep the rationale of significant technical and product decisions available after the related implementation work is complete.

## Examples
### Good
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
### Bad
Not recorded in the source.

## Enforcement
Not recorded in the source.

## Statuses
| Status | Meaning |
| --- | --- |
| `Proposed` | Under discussion; unresolved questions may remain. |
| `Accepted` | Approved as the decision to implement and maintain. |
| `Rejected` | Considered but not selected. |
| `Superseded` | Replaced by a later ADR. |
