# core

Business rules that do not care about HTTP or SQL. A package lands here when it
needs several store calls, or a decision, that more than one transport must
apply the same way.

| Package | Owns |
| --- | --- |
| `access/` | who may read a memo, given viewer, space membership, and share links |
| `notification/` | building and dispatching inbox and email notifications |
| `memopayload/` | rebuilding a memo's derived payload from its markdown |
| `memoexport/` | the Memos Export Format container and records used for export and import |
| `usagelimit/` | which usage limits apply to a user, and whether memo counts, memo content, and uploads stay within them |
| `identityprovider/` | the rules an identity provider must meet before it is stored, and its API↔store conversion |
| `instancesetting/` | the rules each instance setting group must meet before it is stored, AI setting normalization, and the API↔store conversion |
| `user/` | the rules a username and password must meet before they are stored |
| `configuration/` | declarative configuration: reading files (substitution, strict decoding, schema checks, merging), planning and applying them against the instance, and the API ownership guard |

The three validation packages check the complete value as it will be stored.
`identityprovider` and `instancesetting` also convert between API and store
messages, because declarative configuration files are API messages; their
`FromStore` keeps secrets, and API responses redact them in `server/api`.
A write path's own conveniences, such as the API treating an empty secret as
"keep the stored one", run before validation, never inside it.

Layering: `core` may import `store`, `provider`, `markdown`, `filter`,
`proto/gen`, and `internal`. It must not import `server` or `cmd`. New
resource-specific rules extracted from `server/api` belong here, one package
per resource.
