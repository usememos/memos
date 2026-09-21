# ADR 0002: Username Format and References

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).

## Context

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).

Markdown mentions currently drift from the writable username format: the backend accepts up to 63 Unicode letters, numbers, and hyphens; the frontend
accepts up to 63 ASCII characters; both allow invalid username shapes; and extraction lowercases the result. Editor decoration also scans raw source in
contexts where Markdown must be opaque.

## Decision drivers

- Give every username write path one small, stable validation rule.
- Make a reference use the username format instead of inventing another identifier grammar.
- Preserve the spelling and case selected by the user.
- Keep username write validation, reference rendering, extraction, editor recognition, and notification resolution aligned.
- Use parsed Markdown context rather than special-case regular expressions for code, links, email addresses, and other opaque syntax.
- Keep recognition deterministic and linear in memo size.

## Terminology

> Moved to [`.archcore/domain/glossary.doc.md`](../../.archcore/domain/glossary.doc.md).

## Decision

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).

## Consequences

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).

## Alternatives considered

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).

## References

> Moved to [`.archcore/users/username-format-and-references.adr.md`](../../.archcore/users/username-format-and-references.adr.md).
