---
title: "Database and proto compatibility"
status: draft
tags:
  - "conventions"
---

## Rule
1. When changing a database schema, contributors MUST add migrations for SQLite, MySQL, and PostgreSQL under `store/migration/`.
2. When changing a database schema, contributors MUST update each driver's `LATEST.sql`.
3. For database changes, contributors MUST keep fresh-install SQL equivalent to incremental migrations.
4. Unless the task explicitly permits a breaking API change, contributors MUST preserve compatibility when changing proto fields.
5. For generated outputs in `proto/gen/` and `web/src/types/proto/`, contributors MUST NOT hand-edit files.
6. When changing the API schema, contributors MUST edit `.proto` sources under `proto/`.
7. After proto edits, contributors MUST run `buf generate` from `proto/`.
8. After proto generation, contributors MUST include Go, OpenAPI, and TypeScript outputs.

## Rationale
The repository maintains three migration trees under @store/migration and generation configuration in @proto/buf.gen.yaml.

## Examples
Not recorded in the source.

## Enforcement
Not recorded in the source.
