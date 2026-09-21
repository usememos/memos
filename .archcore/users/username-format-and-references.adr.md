---
title: "Username format and references"
status: draft
tags:
  - "users"
---

## Context
Status: Accepted (2026-08-02).
Account writes, authentication, resource lookup, SSO provisioning, and mentions need one username format. Older mention recognizers admitted values outside the writable grammar, while legacy stored names still need lookup compatibility; current validation lives in @internal/identifier/username.go. This decision excludes legacy-data migration, username lifecycle, and downstream notification policy.

## Decision
Use 1–36-character ASCII usernames with alphanumeric ends and interior hyphens, exact case-preserving equality, and Markdown-aware references using that same writable grammar.

## Decision Details
### Identity and allocation
A User has an immutable internal ID; Username is its public, user-selected identifier, distinct from Display Name. A reference spelling alone is not a durable user relationship.
Writable names admit ASCII letters, digits, and hyphens only. Interior hyphens may repeat and digits-only names are valid; neither all-hyphen nor leading/trailing-hyphen names qualify. Alphanumeric ends also rule out all-hyphen values and keep a trailing hyphen from reading ambiguously inside a Markdown mention.
One character supplies the non-empty minimum; 36 permits canonical UUID spelling while bounding public tokens. Internationalized human-readable names belong in Display Name.
Creation, rename, and automatic provisioning share the username-specific validator; a similar generic resource regex is not its substitute.
There are no reserved spellings: `admin`, `root`, `system`, `api`, `memos`, and `support` confer no authority. A later system account claims its name through ordinary uniqueness.
SSO accepts an external identifier only when it is a valid available username; otherwise it allocates a canonical UUID. Matching names never link accounts; the persisted provider-key/external-subject binding identifies returning SSO users.

### Equality and resolution
Validation, uniqueness, authentication, resource lookup, and references preserve spelling without trimming, lowercasing, case folding, or normalization. `Alice` and `alice` are distinct; ` alice ` is invalid.
Storage uses explicit binary comparison: MySQL `utf8mb4_bin`, PostgreSQL `C`, SQLite `BINARY` (@store/migration/mysql/LATEST.sql, @store/migration/postgres/LATEST.sql, @store/migration/sqlite/LATEST.sql).
A username-bearing field resolves digits as a username, never as an implicit internal user ID. Operations addressing internal IDs expose that namespace separately.
Resolution preserves the supplied spelling, looks up that exact name within the consuming operation's visibility/account-status scope, and uses the resulting user ID for durable effects. Unresolved text remains ordinary text without user-targeted effects.
Legacy email-like or underscore-containing names remain exact lookup keys for existing resources and authentication, but are invalid for new writes and new reference syntax.
Rename/reuse together with historical mention stability requires a durable binding outside `@username`; this decision does not define that binding, editing behavior, historical re-resolution, or lifecycle policy.

### Markdown references
A candidate is a literal ASCII `@` followed by a complete writable username. At document start the left boundary succeeds; elsewhere an immediately preceding ASCII letter, digit, or hyphen blocks recognition.
The scanner consumes the complete consecutive ASCII-letter/digit/hyphen run and validates it as a whole, without shortening invalid runs. GFM email recognition takes precedence: recognized email substrings never become mentions.
Underscores, another `@`, and non-ASCII characters are ordinary boundaries without special treatment.
Recognition uses original Markdown after block/inline structure is resolved. Paragraphs, headings, quotes, lists, tables, emphasis, strong emphasis, and strikethrough expose ordinary text.
Code, resolved links/images, autolinks, recognized emails, raw HTML, and math are opaque. Escapes, character references, line endings, and syntax delimiters end source runs; generated or escaped `@` characters are not introducers.
Unknown extension nodes remain opaque until explicitly declared text-exposing. Parsing, rendering, extraction, editor decoration, and future completion share these rules.
Resolution, notification timing/deduplication, visibility, access, and self-mention policies are unchanged. Autocomplete ranking and a structured mention payload are outside scope.

### Representative outcomes
| Input | Result |
| --- | --- |
| `alice`, `Alice-2`, `1alice`, `a--b`, `a---b`, `123`, `123-456` | Writable, exact spelling retained |
| `00000000-0000-0000-0000-000000000000` | Writable 36-character UUID |
| `-alice`, `alice-`, `alice_smith`, `alice@example.com`, `álîçé`, `张三` | Not writable |
| `@alice`, `@Alice-2`, `hi, @alice.`, `中文@alice` | Candidate with the exact username spelling |
| `hello@alice`, `foo-@alice`, `@-alice`, `@alice-` | No candidate |
| `foo_@alice`, `@alice_smith`, `@alice@example`, `@alice@bob` | Candidate `alice` |
| `@123` | Username candidate `123` |
| `@alice@example.com` | No candidate: email takes precedence |
| `@` plus 37 username characters | No candidate; no valid-prefix fallback |

## Alternatives Considered
- **Mention-first grammar:** rejected because it creates a second identifier language that can drift from account validation.
- **Broader mention tokens:** rejected because accepted references would not reliably identify newly writable accounts and would complicate boundaries, validation, and UI messaging.
- **Stable IDs inside mentions:** deferred because persisted occurrence bindings or new source syntax require editing, import/export, and compatibility decisions.
- **Unicode usernames:** deferred because they require pinned Unicode, normalization, script/confusable policy, and matching database collations.

## Consequences
### Positive
- Validation and references share one domain grammar; mixed-case names retain their exact spelling.
- Explicit collations align username uniqueness and lookup across the three databases.
- Markdown context excludes false mentions inside code, links, emails, HTML, math, escapes, and character references.
### Tradeoffs
- Former 63-character or Unicode mention candidates outside the writable format stop qualifying.
- Legacy names remain usable for lookup but cannot be introduced as new Markdown mentions.
- Stable historical targets across rename/reuse remain unresolved by source spelling alone.
- Mention syntax follows future username-format decisions only when this ADR is superseded and both uses are updated together.

## References
- [GitHub Flavored Markdown 0.29-gfm](https://github.github.com/gfm/)
- [GitHub: Mentioning people and teams](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#mentioning-people-and-teams)
- [Slack message formatting: mentioning users](https://docs.slack.dev/messaging/formatting-message-text/#mentioning-users)
- [Matrix client-server API: user and room mentions](https://spec.matrix.org/latest/client-server-api/#user-and-room-mentions)
- [Activity Streams 2.0 Vocabulary: Mention](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-mention)
- [Unicode Standard Annex #31: Unicode Identifiers and Syntax](https://www.unicode.org/reports/tr31/)
- [Unicode Technical Standard #39: Unicode Security Mechanisms](https://www.unicode.org/reports/tr39/)
