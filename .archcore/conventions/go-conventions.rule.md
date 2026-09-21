---
title: "Go conventions"
status: draft
tags:
  - "conventions"
---

## Rule
1. For Go error wrapping, contributors MUST use `errors.Wrap(err, "context")` from `github.com/pkg/errors`.
2. In Go code, contributors MUST NOT use `fmt.Errorf`.
3. For service errors, contributors MUST return `status.Errorf(codes.X, "message")`.
4. For Go imports, contributors MUST group standard-library imports, third-party imports, then `github.com/usememos/memos` imports.
5. For exported Go identifiers, contributors MUST add documentation comments.
6. Unless the surrounding package already uses that pattern, contributors SHOULD NOT introduce package-level mutable state.

## Rationale
Not recorded in the source.

## Examples
Not recorded in the source.

## Enforcement
goimports is run by golangci-lint, and godot enforces exported comment punctuation; the lint configuration is @.golangci.yaml. Enforcement of the other clauses is not recorded in the source.
