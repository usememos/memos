# Memo Filter Engine

This package houses the memo-only filter engine that turns standard CEL syntax
into SQL fragments for the subset of expressions supported by the memo schema.

> Moved to [`.archcore/filter/filter-engine.doc.md`](../.archcore/filter/filter-engine.doc.md).

## Core Files

> Moved to [`.archcore/filter/filter-engine.doc.md`](../.archcore/filter/filter-engine.doc.md).

## SQL Generation Notes

> Moved to [`.archcore/filter/filter-contract.spec.md`](../.archcore/filter/filter-contract.spec.md).

- **Timestamp Accessors** — The same accessors on `now` fold
  to literal date parts of the frozen evaluation time (UTC), so saved filters
  like `created_ts.getMonth() == now.getMonth() && created_ts.getDate() ==
  now.getDate()` ("on this day") re-resolve on every compile.

## Typical Integration

> Moved to [`.archcore/filter/filter-engine.doc.md`](../.archcore/filter/filter-engine.doc.md).
