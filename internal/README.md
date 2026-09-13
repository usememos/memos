# internal

Private plumbing with no memos vocabulary. A package belongs here only if it
could be published tomorrow as a standalone module without changes: it imports
nothing from `store`, `core`, `server`, `provider`, `markdown`, `filter`, or
`proto/gen`. The `depguard` rules in `.golangci.yaml` enforce that.

| Package | Purpose |
| --- | --- |
| `clientip/` | trusted-proxy aware client IP resolution middleware |
| `email/` | SMTP client, config, and message types |
| `identifier/` | grammar of UIDs and usernames shared by parser, store, and API |
| `linkmeta/` | HTML metadata, oEmbed, and image fetching for link previews |
| `motionphoto/` | Live Photo and Motion Photo container parsing |
| `profile/` | process configuration parsed from flags and environment |
| `random/` | UUIDs and random strings from a secure source |
| `ratelimit/` | sliding-window rate limiter |
| `testutil/` | test fixtures and the fake S3 server (the one package allowed to import `proto/gen`) |
| `version/` | build version and version comparison |
| `webhook/` | signed webhook delivery with SSRF protection |

Do not add `util`, `common`, `base`, or `helpers` packages. Name a package for
the one thing it does, or put the code next to its only caller.
