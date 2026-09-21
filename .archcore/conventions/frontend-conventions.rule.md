---
title: "Frontend conventions"
status: draft
tags:
  - "conventions"
---

## Rule
1. For absolute imports in `web/src/`, contributors MUST use the `@/` alias.
2. For frontend formatting, contributors MUST use two-space indentation, double quotes, semicolons, and a 140-character line width.
3. For server data in `web/src/`, contributors MUST use React Query hooks under `web/src/hooks/`.
4. For UI-only state in `web/src/`, contributors MUST use contexts or component state.
5. For styling in `web/src/`, contributors MUST use Tailwind CSS v4 utilities.
6. For class merging in `web/src/`, contributors MUST use `cn()`.
7. For component variants in `web/src/`, contributors MUST use CVA.
8. Before adding UI primitives in `web/src/`, contributors MUST reuse existing components where they serve the same purpose.
9. For generated TypeScript under `web/src/types/proto/`, contributors MUST NOT hand-edit files or apply Biome rewrites.

## Rationale
The alias is configured in @web/tsconfig.json; formatting and generated-code exclusions are configured in @web/biome.json. `cn()` and CVA appear in @web/src/components/ui/button.tsx.

## Examples
Not recorded in the source.

## Enforcement
Not recorded in the source.
