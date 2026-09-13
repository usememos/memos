# core

Business rules that do not care about HTTP or SQL. A package lands here when it
needs several store calls, or a decision, that more than one transport must
apply the same way.

| Package | Owns |
| --- | --- |
| `access/` | who may read a memo, given viewer, space membership, and share links |
| `notification/` | building and dispatching inbox and email notifications |
| `memopayload/` | rebuilding a memo's derived payload from its markdown |

Layering: `core` may import `store`, `provider`, `markdown`, `filter`,
`proto/gen`, and `internal`. It must not import `server` or `cmd`. New
resource-specific rules extracted from `server/api/v1` belong here, one package
per resource.
