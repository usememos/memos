# AGENTS.md

Repository instructions for AI coding agents. Keep this file short, concrete, and tied to commands that actually work in this
repo. If a fact here conflicts with source files or CI config, trust the source file and update this guide.

## Project Snapshot

> Moved to [`.archcore/conventions/project-stack.rule.md`](.archcore/conventions/project-stack.rule.md) and [`.archcore/architecture/top-level-map.doc.md`](.archcore/architecture/top-level-map.doc.md).

- Frontend: TypeScript 6.

## Working Rules

> Moved to [`.archcore/conventions/working-rules.rule.md`](.archcore/conventions/working-rules.rule.md) and [`.archcore/conventions/database-and-proto.rule.md`](.archcore/conventions/database-and-proto.rule.md).

## Commands

> Moved to [`.archcore/onboarding/running-the-project.guide.md`](.archcore/onboarding/running-the-project.guide.md).

## Repository Layout

> Moved to [`.archcore/conventions/working-rules.rule.md`](.archcore/conventions/working-rules.rule.md) and [`.archcore/architecture/top-level-map.doc.md`](.archcore/architecture/top-level-map.doc.md).

## Change Routing

> Moved to [`.archcore/conventions/verification-policy.rule.md`](.archcore/conventions/verification-policy.rule.md) and [`.archcore/architecture/top-level-map.doc.md`](.archcore/architecture/top-level-map.doc.md).

## Go Conventions

> Moved to [`.archcore/conventions/go-conventions.rule.md`](.archcore/conventions/go-conventions.rule.md).

## Frontend Conventions

> Moved to [`.archcore/conventions/frontend-conventions.rule.md`](.archcore/conventions/frontend-conventions.rule.md).

- Reuse Radix primitives and existing components before adding new UI primitives.

## Database And Proto Rules

> Moved to [`.archcore/conventions/database-and-proto.rule.md`](.archcore/conventions/database-and-proto.rule.md).

## Verification Policy

> Moved to [`.archcore/conventions/verification-policy.rule.md`](.archcore/conventions/verification-policy.rule.md).

## CI Reference

> Moved to [`.archcore/conventions/project-stack.rule.md`](.archcore/conventions/project-stack.rule.md) and [`.archcore/onboarding/running-the-project.guide.md`](.archcore/onboarding/running-the-project.guide.md).

<!-- archcore:start --> managed by `archcore init` — edit outside these markers
## Archcore — project context for this repo

This repo's architecture, decisions, rules, specs and patterns live in `.archcore/`,
reachable through the Archcore MCP tools. Consult them even on code you think you
know — a decision or rule may already constrain it.

- Touching this repo's real code or behavior → search first; read only what matches.
- A decision was made ("we'll use X", "from now on Y") → record it.
- A module / API / system has no doc — or a search comes back empty → capture it.
- Planning a feature or refactor → scope it against what's already decided.

A `.archcore/` may also mount read-only **global sources** — shared, org-wide
context not shown in the session-start list. `list_documents` / `search_documents`
surface them alongside local docs, tagged `source_kind: "global"`. When present,
treat them as defaults a local doc can override — never edit or relate to one.

The search is cheap — lean on it. Skip it only for turns this repo would have no
opinion on: syntax trivia, throwaway snippets, pure mechanics.
<!-- archcore:end -->
