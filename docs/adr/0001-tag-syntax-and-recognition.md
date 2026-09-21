# ADR 0001: Tag Syntax and Recognition

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md).

## Context

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md).

Memos currently has four related but different implementations:

- The Go Markdown parser recognizes Unicode letters, marks, numbers, and symbols, plus `ZWJ`, `_`, `-`, `/`, and `&`. It extracts at most 100 Unicode
  code points and has no general left boundary.
- The read-only remark plugin uses a similar frontend character class without `ZWJ`. It rejects a run longer than 100 code points and has special handling
  for adjacent `#` characters.
- The editor decoration uses the frontend character class but requires a non-letter/non-number before `#`, so it does not highlight `hello#tag`. It scans
  raw text without consulting the editor's Markdown syntax tree.
- Editor completion has no left boundary, no length limit, and no Markdown-context check.

## Decision drivers

- Work naturally for multilingual personal notes, including numeric tags and emoji.
- Preserve common word-internal apostrophes without absorbing surrounding quotation punctuation into tag values.
- Recognize `hello#tag` intentionally without mistaking URL fragments for tags.
- Give the backend, renderer, editor decoration, and completion the same values and source spans.
- Use Markdown syntax rather than ad hoc URL or code regular expressions.
- Avoid accepting every Unicode symbol merely to support emoji.
- Keep parsing deterministic across Go, JavaScript runtimes, and Unicode upgrades.
- Keep lexical scanning linear in memo size.

## Terminology

> Moved to [`.archcore/domain/glossary.doc.md`](../../.archcore/domain/glossary.doc.md), [`.archcore/tags/tag-contract-lexical.spec.md`](../../.archcore/tags/tag-contract-lexical.spec.md), [`.archcore/tags/tag-contract-context.spec.md`](../../.archcore/tags/tag-contract-context.spec.md), and [`.archcore/tags/tag-contract-identity.spec.md`](../../.archcore/tags/tag-contract-identity.spec.md).

## Decision

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md), [`.archcore/tags/tag-contract-lexical.spec.md`](../../.archcore/tags/tag-contract-lexical.spec.md), [`.archcore/tags/tag-contract-context.spec.md`](../../.archcore/tags/tag-contract-context.spec.md), and [`.archcore/tags/tag-contract-identity.spec.md`](../../.archcore/tags/tag-contract-identity.spec.md).

## Conformance examples

> Moved to [`.archcore/tags/tag-examples-lexical.scenario.md`](../../.archcore/tags/tag-examples-lexical.scenario.md), [`.archcore/tags/tag-examples-context.scenario.md`](../../.archcore/tags/tag-examples-context.scenario.md), and [`.archcore/tags/tag-examples-identity.scenario.md`](../../.archcore/tags/tag-examples-identity.scenario.md).

## Consequences

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md).

## Alternatives considered

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md).

## References

> Moved to [`.archcore/tags/tag-syntax-and-recognition.adr.md`](../../.archcore/tags/tag-syntax-and-recognition.adr.md), [`.archcore/tags/tag-contract-lexical.spec.md`](../../.archcore/tags/tag-contract-lexical.spec.md), [`.archcore/tags/tag-contract-context.spec.md`](../../.archcore/tags/tag-contract-context.spec.md), and [`.archcore/tags/tag-contract-identity.spec.md`](../../.archcore/tags/tag-contract-identity.spec.md).
