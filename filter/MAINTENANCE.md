# Maintaining the Memo Filter Engine

The engine is memo-specific; any future field or behavior changes must stay
consistent with the memo schema and store implementations.

> Moved to [`.archcore/filter/maintenance.guide.md`](../.archcore/filter/maintenance.guide.md).

## Debugging Tips

- **Store integration** – Ensure drivers call `filter.DefaultEngine()` exactly once
  per process; the singleton caches the parsed CEL environment.
