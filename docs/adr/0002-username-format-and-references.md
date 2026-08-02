# ADR 0002: Username Format and References

Status: Accepted

Date: 2026-08-02

Domain glossary: [Memos domain glossary](../glossary.md)

## Context

A username is a user identifier used by account creation and updates, authentication, public user resource names, API lookup, SSO provisioning, and
references to users. Those uses must share one format rather than defining separate username-like tokens.

Memos already restricts newly written usernames to ASCII letters, digits, and hyphens, with a 36-character limit and alphanumeric ends. Existing
installations may also contain older usernames such as email addresses or values with underscores. Memos continues to read and resolve those legacy
values, but they are not valid new usernames.

Markdown mentions currently drift from the writable username format: the backend accepts up to 63 Unicode letters, numbers, and hyphens; the frontend
accepts up to 63 ASCII characters; both allow invalid username shapes; and extraction lowercases the result. Editor decoration also scans raw source in
contexts where Markdown must be opaque.

This ADR defines:

- The format and case-preservation semantics for writable usernames.
- How username references resolve.
- Markdown mention as one source form of username reference.

Changing or migrating legacy username data is outside this ADR's scope.
Username rename and reuse policy, and the durable binding of an already resolved mention across those lifecycle events, are also outside scope.
Notification timing, deduplication, access policy, self-mention behavior, and other downstream effects are unchanged and outside scope.

## Decision drivers

- Give every username write path one small, stable validation rule.
- Make a reference use the username format instead of inventing another identifier grammar.
- Preserve the spelling and case selected by the user.
- Keep username write validation, reference rendering, extraction, editor recognition, and notification resolution aligned.
- Use parsed Markdown context rather than special-case regular expressions for code, links, email addresses, and other opaque syntax.
- Keep recognition deterministic and linear in memo size.

## Terminology

**User**
: A durable Memos account identified internally by an immutable user ID.

**Username**
: A user-selected, case-sensitive public identifier used for account addressing. A username is distinct from a display name and from the user's internal
  ID.

**Writable username**
: A username accepted when an account is created, renamed, or provisioned after this decision.

**Legacy username**
: A stored username that does not satisfy the writable format but remains readable and addressable for compatibility.

**Username reference**
: Source text that names a username so Memos can attempt to resolve it to a user ID. The source spelling is not itself a durable relationship.

**Mention candidate**
: A Markdown source span with the form `@` followed by a complete writable username and satisfying the mention boundary and context rules.

**Resolved mention**
: A mention candidate whose username resolves to a user under the consuming operation's existing account-status and visibility policy.

## Decision

### Writable username format

The normative grammar is:

```text
Username          := Alphanumeric
                   | Alphanumeric UsernameCharacter{0,34} Alphanumeric
UsernameCharacter := Alphanumeric | "-"
Alphanumeric      := ASCII letter | ASCII digit
ASCII letter      := "A".."Z" | "a".."z"
ASCII digit       := "0".."9"
```

- A username is 1 through 36 ASCII characters.
- ASCII letters, digits, and `-` are the only admitted characters.
- The first and last characters are letters or digits.
- Consecutive interior hyphens are valid; there is no additional rule limiting their number.
- A digits-only value is valid.
- Case is preserved.

Requiring alphanumeric ends also excludes values made only of hyphens and prevents a trailing hyphen from becoming an ambiguous-looking part of a
Markdown mention.

The minimum is one because Username needs no product-level namespace-scarcity policy beyond being non-empty. The maximum is 36 so every UUID value has a
canonical textual representation that fits while public URLs and reference tokens remain bounded.

The ASCII-only restriction is intentional: Username is a machine-facing public identifier used in URLs, authentication, and references. Internationalized
human-readable naming belongs to Display Name rather than expanding Username normalization and comparison rules.

Examples:

| Value | Writable | Reason |
| --- | --- | --- |
| `alice` | yes | Letters only |
| `Alice-2` | yes | Case is preserved; interior hyphen is valid |
| `1alice` | yes | A digit may begin a username that also contains a letter |
| `a--b` | yes | Consecutive interior hyphens are valid |
| `a---b` | yes | Interior hyphens have no repetition limit |
| `123` | yes | Numeric spelling has no special meaning |
| `123-456` | yes | Digits and interior hyphens satisfy the grammar |
| `00000000-0000-0000-0000-000000000000` | yes | A canonical UUID occupies 36 characters |
| `-alice` | no | A hyphen cannot begin a username |
| `alice-` | no | A hyphen cannot end a username |
| `alice_smith` | no | `_` is outside the format |
| `alice@example.com` | no | Email syntax is outside the format |
| `álîçé` | no | The writable format is ASCII |
| `张三` | no | Internationalized naming belongs to Display Name |

All account creation, username update, and automatic provisioning paths use this rule. A generic resource-name rule is not the username contract and
must not be reused as a substitute merely because its current regular expression is similar.

### Username allocation

The writable format has no reserved spellings. Values such as `admin`, `root`, `system`, `api`, `memos`, and `support` are ordinary usernames and are
available subject to the same exact-case uniqueness rule as every other value. A username does not grant authority or establish trust; those properties
come from the resolved user ID, role, and explicit product presentation. Manual registration, rename, and automatic provisioning apply the same policy.

If Memos later needs a system-owned username, the corresponding account claims it through ordinary uniqueness rather than expanding a lexical reserved
list.

SSO provisioning adopts the external identifier exactly when it is a valid, available writable username. If it is invalid or already belongs to another
user, provisioning assigns a generated canonical UUID instead. A matching username never links or takes over an account; only the persisted identity
binding formed by the identity-provider key and external subject identifies a returning SSO user.

### Username identity and resolution

Username spelling is case-preserving and username equality is exact ASCII byte equality. Memos does not lowercase, case-fold, or otherwise normalize a
username before validation, uniqueness checks, authentication, resource lookup, or reference resolution. In particular, surrounding whitespace is not
trimmed into a different username; a value such as ` alice ` is invalid. `Alice` and `alice` are distinct usernames and may identify different users.

All storage backends and application lookup paths must preserve this equality rule. A database collation that treats `Alice` and `alice` as equal, or a
lookup that silently resolves one spelling to the other, does not conform to this decision.

The `username` column therefore uses an explicit case-sensitive binary collation on every supported storage backend: `utf8mb4_bin` on MySQL, `C` on
PostgreSQL, and `BINARY` on SQLite. For the writable ASCII format, this makes exact-byte uniqueness and lookup a schema property rather than an assumption
about each database's default collation.

A username-bearing field or resource-name segment always resolves as a username, including when its spelling contains only digits. Character shape must
not select the internal user-ID namespace; an operation that addresses a user by internal ID must expose that choice separately.

The stable identity of a user is the internal user ID. A username reference is resolved as late as the consuming operation permits:

1. Preserve the username exactly as written.
2. Look up that exact username in the operation's visibility and account-status scope.
3. If it resolves, use the resulting user ID for durable effects.
4. If it does not resolve, retain ordinary source text and produce no user-targeted effect.

Product intent permits username rename and later reuse while requiring an already resolved mention not to change users. A source spelling alone cannot
satisfy all three properties: preserving the original target requires a durable binding to the user ID outside the `@username` text. This ADR does not
define that binding, historical re-resolution behavior, or the username lifecycle needed to support it.

Legacy usernames remain valid exact lookup keys for existing API resource names and authentication flows. They are not accepted by write validation and
are not added to new reference syntaxes. Changing legacy username values remains outside this decision, but every lookup preserves their stored spelling.

### Markdown mention syntax

A Markdown mention is the first defined username-reference syntax:

```text
MentionCandidate := "@" Username
```

The `Username` production is the complete writable username format above. Mention parsing has no independent character set or length limit.

Candidate recognition follows these rules:

1. The `@` is U+0040 COMMERCIAL AT in an eligible literal-source run.
2. At the start of the document, the left boundary is satisfied. Otherwise the immediately preceding source character must not be a
   `UsernameCharacter`. The username format therefore defines the boundary: a preceding letter, digit, or hyphen blocks recognition.
3. The lexer consumes the complete consecutive run of ASCII letters, digits, and hyphens after `@`, then validates that whole run as a writable username.
   It does not shorten an invalid run into a valid prefix.
4. GFM email-address recognition takes precedence. No substring of a recognized email address is a mention.

Characters outside `UsernameCharacter`, including `_`, `@`, and non-ASCII characters, are ordinary boundaries and receive no special handling.

The rules produce:

| Source | Mention candidate |
| --- | --- |
| `@alice` | `alice` |
| `@Alice-2` | `Alice-2` |
| `hi, @alice.` | `alice` |
| `中文@alice` | `alice` |
| `hello@alice` | none |
| `foo-@alice` | none |
| `foo_@alice` | `alice` |
| `@123` | `123` |
| `@-alice` | none |
| `@alice-` | none |
| `@alice_smith` | `alice` |
| `@alice@example` | `alice` |
| `@alice@bob` | `alice` |
| `@alice@example.com` | none |
| `@` followed by 37 valid username characters | none |

### Markdown context

Mention recognition operates on original Markdown source after GFM and Memos block and inline structure is resolved. It uses the same literal-source-run
and opaque-node model as other Memos inline extensions:

- Paragraphs, headings, block quotes, list items, table text, emphasis, strong emphasis, and strikethrough expose ordinary text.
- Code spans, code blocks, resolved links and images, autolinks, recognized GFM email addresses, raw HTML, and math are opaque.
- Escapes, character references, line endings, and syntax delimiters end a literal-source run. An escaped or character-reference-produced `@` is not an
  introducer.
- Unknown future Markdown extension nodes are opaque unless their definition explicitly exposes ordinary text.

Parsing, read rendering, metadata extraction, editor decoration, and any future mention completion must use these same lexical and context rules.

This decision changes only which exact username spellings are extracted as mention candidates. Existing resolution, rendering, notification, and access
policies consume those candidates without otherwise changing behavior. Autocomplete, suggestion ranking, and a dedicated structured mention payload are
also outside this decision.

## Consequences

- Username validation becomes a domain primitive shared by every write path.
- Username uniqueness, authentication, resource lookup, and reference resolution use the same case-sensitive equality rule on every storage backend.
- Mention syntax automatically follows future username-format decisions only when this ADR is superseded and both uses are updated together.
- Existing valid mixed-case usernames can be mentioned without lowercasing.
- Values accepted only by the old 63-character or Unicode mention lexers stop being mention candidates because they were never writable usernames.
- Legacy email-like or underscore-containing usernames remain usable through compatibility lookup but cannot be authored as new Markdown mentions.
- Markdown-aware recognition removes false mentions from code, links, email addresses, HTML, math, escapes, and character references.
- Username rename, reuse, and historical mention stability remain an explicit follow-up because source text alone cannot represent the intended stable
  user binding.

## Alternatives considered

### Define mention syntax first

Rejected because it creates a second username-like grammar and allows account validation and references to drift again.

### Allow a broader mention token than writable usernames

Rejected because such candidates cannot reliably identify newly writable accounts and complicate boundaries, validation, and UI messaging.

### Store stable user IDs with a mention

Deferred. Stable IDs make renames and username reuse robust but require either a new source representation or persisted occurrence bindings, plus editing
UX, import/export behavior, and compatibility policy. Exact username references are sufficient for candidate recognition in the current scope, but do not
solve historical binding.

### Unicode usernames

Deferred. A safe Unicode identifier design needs a pinned Unicode version, normalization, script and confusable policy, and consistent database collation.
ASCII keeps this decision small and matches the existing writable format.

## References

- [GitHub Flavored Markdown 0.29-gfm](https://github.github.com/gfm/)
- [GitHub: Mentioning people and teams](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#mentioning-people-and-teams)
- [Slack message formatting: mentioning users](https://docs.slack.dev/messaging/formatting-message-text/#mentioning-users)
- [Matrix client-server API: user and room mentions](https://spec.matrix.org/latest/client-server-api/#user-and-room-mentions)
- [Activity Streams 2.0 Vocabulary: Mention](https://www.w3.org/TR/activitystreams-vocabulary/#dfn-mention)
- [Unicode Standard Annex #31: Unicode Identifiers and Syntax](https://www.unicode.org/reports/tr31/)
- [Unicode Technical Standard #39: Unicode Security Mechanisms](https://www.unicode.org/reports/tr39/)
