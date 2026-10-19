# AppPort bridge for Memos (opt-in, read-only)

A small, separate Node.js process that lets an [AppPort](https://www.npmjs.com/package/@appport/sdk) consumer discover
and call two **read-only** Memos capabilities. It does not change Memos: no Go code, protos, schema or configuration are
touched, and nothing runs unless you start it.

| Capability | Memos endpoint used | Notes |
|---|---|---|
| `memos.search@1` | `GET /api/memos?filter=…` | `text` → `content.contains("…")`, `tag` → `"…" in tags`; Memos applies visibility |
| `memos.get@1` | `GET /api/memos/{uid}` | full memo, if Memos lets the caller read it |

## How authority stays with Memos

* **Trusted-boundary mode** (`@appport/server` README): the bridge forwards each call to Memos' own HTTP API with the
  **caller's own Memos personal access token**. Memos' existing handlers, visibility rules (PRIVATE / PROTECTED /
  PUBLIC, creator ownership) and storage decide everything.
* The bridge has **no credential of its own**, **stores nothing** and never logs tokens or note content.
* AppPort only checks that a credential was presented (anonymous calls get `UNAUTHORIZED` without reaching Memos).
  Memos' answers map to AppPort errors: 401 → `UNAUTHORIZED`, 403 → `FORBIDDEN`, 404 → `NOT_FOUND`.
* Discovery is opt-in (`APPPORT_BRIDGE_PUBLIC=1`) and is never authorization.
* A host that adds capabilities to the bridge may also publish manifest `extensions` and `attributes` through
  `startBridge` (for example an AppPort fulfillment claim, `appport.fulfillment/1`, built with `@appport/protocol`'s
  `claimFor` and `fulfillmentAttributes`). They are declarations, published as given: they grant no caller any permission,
  and `appport.integration/1` stays reserved for the integration descriptor.
* Input is constrained by the published contract (e.g. `name` must match `memos/<uid>`), so malformed requests are
  rejected before Memos is contacted.

## Run

```sh
cd appport-bridge && npm ci
APPPORT_BRIDGE_UPSTREAM=http://127.0.0.1:5230 APPPORT_BRIDGE_PORT=4410 APPPORT_BRIDGE_PUBLIC=1 npm start
```

A consumer (`@appport/sdk`):

```js
import { AppPort } from "@appport/sdk";
const found = await AppPort.discoverApplication({ origin: "http://127.0.0.1:4410" });   // reference-verified, not trust
const app = await AppPort.discover({ origin: "http://127.0.0.1:4410", headers: { authorization: "Bearer memos_pat_..." } });
const { memos } = await app.call("memos.search", { text: "turnips" }, { version: 1 });
```

The bridge listens on `127.0.0.1` unless `APPPORT_BRIDGE_HOST` says otherwise. Put TLS in front of it before exposing it
beyond localhost: callers send their Memos tokens to it.

## Test

`npm test` starts a **real Memos server** (SQLite in a temp dir; `MEMOS_BIN=/path/to/memos` to reuse a build, otherwise it
runs `go build ./cmd/memos`), creates synthetic users and notes through Memos' own API, starts the bridge, and checks
everything as an independent consumer using only the published `@appport/sdk`:

* discovery is opt-in and `reference-verified`; nothing (trust, authorization, approval) is established by it
* every successful result is compared with **Memos' own `memo` table, read directly** (read-only), never with the bridge's word
* carol cannot read bob's private memo (`FORBIDDEN`, while the database shows it exists); no token → `UNAUTHORIZED`;
  an invalid token is rejected by Memos
* a missing memo is `NOT_FOUND`; malformed input is `INVALID_INPUT`
* a lost response is *indeterminate*, never confirmed, and is sent once
* all disposable data is removed

`test/kit.test.mjs` needs no Memos: it checks that manifest extensions and attributes are published exactly as given,
that without them nothing changes, and that a declaration does not let an anonymous caller in.

Package versions are pinned exactly (`@appport/sdk` 1.2.2) and installed from the npm registry via `package-lock.json`.
Requires Node 22.13+ (uses the built-in `node:sqlite` for the read-only database check).
