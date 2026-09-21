---
title: "Repository top-level map"
status: draft
tags:
  - "architecture"
  - "top-level-map"
---

## Overview

Memos is a self-hosted note-taking app: a Go backend process in @server, built from @cmd/memos, and a React SPA in @web/src. Every root folder is named for what it holds, and a root folder's `doc.go` or `README.md` describes it. Imports point downward only, `cmd` → `server` → `core` → `store` → {`provider`, `markdown`, `filter`} → `internal`; these layering rules are enforced by `depguard` in @.golangci.yaml.

## Content

### Domains

| Domain | Path | Holds | May import |
| --- | --- | --- | --- |
| CLI | @cmd/memos | Cobra/Viper CLI setup and server startup. | anything |
| Server | @server | The HTTP process: Echo bootstrap, graceful shutdown, and every transport. | core, store, provider, markdown, filter, internal |
| Core | @core | Business rules with no HTTP and no SQL (`access`, `notification`, `memopayload`, `memoexport`). | store, provider, markdown, filter, internal |
| Store | @store | Store facade, cache, migrations, and the `Driver` interface, implemented in @store/db/sqlite, @store/db/mysql, and @store/db/postgres. | provider, markdown, filter, internal |
| Markdown | @markdown | Markdown engine: parser, AST, memos syntax extensions, renderer, and memo payload. | proto/gen, internal |
| Filter | @filter | CEL filter compiler: parse to IR, render to SQL per driver, filterable field schema. | internal |
| Provider | @provider | Backends configured by instance settings: `ai`, `idp`, `storage`. | proto/gen, internal |
| Internal | @internal | Private plumbing with no memos vocabulary (`identifier`, `email`, `webhook`, `ratelimit`, and others). | third party only |
| Proto | @proto/api/v1, @proto/store | Public API and internal storage proto sources; generated output lives in @proto/gen. | |
| Web | @web/src | React SPA: `connect.ts` clients, `auth-state.ts`, `hooks/`, `contexts/`, `components/`, `themes/`. | |

### Server transports

| Path | Holds |
| --- | --- |
| @server/api/v1 | Connect/gRPC-Gateway services, ACL config (@server/api/v1/acl_config.go), and the SSE hub. Handlers stay thin; rules live in @core. |
| @server/fileserver | Native HTTP file serving, thumbnails, and range requests. |
| @server/frontend | Static SPA serving; `dist/` is the built SPA embedded by `go:embed`. |
| @server/mcp | Model Context Protocol server. |
| @server/auth | JWT access tokens, refresh tokens, and PAT handling. |

### Generated API outputs

| Output | Path |
| --- | --- |
| Go and OpenAPI | @proto/gen |
| TypeScript | @web/src/types/proto |

## Examples
Not recorded in the source.
