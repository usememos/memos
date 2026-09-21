---
title: "Internal package responsibilities"
status: draft
tags:
  - "architecture"
---

## Overview

@internal holds private plumbing with no memos vocabulary. A package belongs here only when it could be published as a standalone module without changes: it imports nothing from `store`, `core`, `server`, `provider`, `markdown`, `filter`, or `proto/gen`. The `depguard` rules in @.golangci.yaml enforce that.

## Content

| Package | Purpose |
| --- | --- |
| @internal/clientip | Trusted-proxy aware client IP resolution middleware. |
| @internal/email | SMTP client, config, and message types. |
| @internal/identifier | Grammar of UIDs and usernames shared by parser, store, and API. |
| @internal/linkmeta | HTML metadata, oEmbed, and image fetching for link previews. |
| @internal/motionphoto | Live Photo and Motion Photo container parsing. |
| @internal/profile | Process configuration parsed from flags and environment. |
| @internal/random | UUIDs and random strings from a secure source. |
| @internal/ratelimit | Sliding-window rate limiter. |
| @internal/testutil | Test fixtures and the fake S3 server; the one package allowed to import `proto/gen`. |
| @internal/version | Build version and version comparison. |
| @internal/webhook | Signed webhook delivery with SSRF protection. |

Do not add `util`, `common`, `base`, or `helpers` packages. Name a package for the one thing it does, or put the code next to its only caller.

## Examples
Not recorded in the source.
