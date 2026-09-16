# Cloudflare D1 Driver Design

Status: Accepted

Date: 2026-09-15

Existing domain language: [Memos context](../../CONTEXT.md)

Related: [Multi-Spaces Design](multi-spaces.md)

## Summary

Memos gains a fourth database engine, Cloudflare D1, selected with
`--driver d1`. D1 runs SQLite, but it is reached over HTTP rather than a
local file or socket, either through Cloudflare's REST API or through a
bridge Worker the deployment provides, it exposes no interactive
transactions, and it accepts no custom SQL functions. Those three facts make it a different
engine from the SQLite driver rather than a variant of it, so it lives in its
own package, `store/db/d1`, with its own migration directory, its own filter
dialect, and its own test harness, exactly like MySQL and PostgreSQL.

## Goals

- Run an unmodified Memos binary against a D1 database from any host, with
  a Cloudflare API token or with access the deployment already holds through
  a Worker binding.
- Keep every store invariant the other drivers enforce: no partial writes,
  no stale-read overwrites, the same error values for the same conditions.
- Share no Go code with the SQLite driver so either can change freely.
- Run the full store test suite without a Cloudflare account.

## Non-goals

- Running Memos inside Cloudflare Workers. The server is a Go binary; D1 is
  only its database.
- Hiding D1's limits. Statements bind at most 100 parameters, a row or blob
  is at most 2 MB, and every query is an HTTP round trip. The driver respects
  the first, surfaces the second as an error, and does nothing about the third.
- General regular-expression filters. D1 has no `REGEXP` operator and cannot
  load one. `matches()` works only for literal text with optional `^` and `$`
  anchors, rendered as case-sensitive substring, prefix, suffix, or equality
  tests; any other pattern is rejected at compile time.

## Configuration

Two access modes exist. Either one leaves the driver's behaviour, the schema,
and the data untouched; switching is a DSN change.

**REST mode** talks to the Cloudflare REST API with an API token that has the
D1 Edit permission:

```
--driver d1 --dsn 'd1://<account_id>/<database_id>?token=<api_token>'
```

The token may instead come from `CLOUDFLARE_API_TOKEN` so it stays out of
process listings. An `endpoint` query parameter overrides the API base URL and
exists for the test emulator.

**Bridge mode** talks to a Worker the deployment provides. The Worker holds the
D1 binding and implements the bridge protocol below, so Memos needs no
Cloudflare API token. The bridge is reached in one of two ways.

*Private path.* When Memos runs as a Cloudflare Container, its Worker can
serve the bridge on a virtual hostname through an `outboundByHost` handler.
Cloudflare intercepts the container's plain-HTTP requests to that hostname
and runs the handler in the Workers runtime, on the same machine, reachable
only from the container's own egress. No credential is involved:

```
--driver d1 --dsn 'd1-bridge://d1.internal/d1?private=true'
```

`private=true` states that the platform keeps the path private; the driver
then uses plain HTTP and requires no secret. This is the recommended
deployment for Containers because there is nothing to provision or rotate.

*Public HTTPS endpoint.* A bridge exposed on a public route must be
protected by a shared secret. Generate one, for example with
`openssl rand -hex 32`, and configure the same value on both sides: Memos
reads `MEMOS_D1_BRIDGE_TOKEN` and sends it as `Authorization: Bearer`; the
Worker reads `BRIDGE_SECRET` and checks it before executing any SQL. Keep the
secret out of the DSN so it stays out of process listings:

```
MEMOS_D1_BRIDGE_TOKEN=<secret> memos --driver d1 --dsn 'd1-bridge://worker.example.com/d1'
```

The driver refuses a public bridge DSN without a secret. This secret is a
random credential the operator generates, not a Cloudflare API token.

## Transport

The driver holds one HTTP transport for the database, selected by the access
mode. The driver methods see only its four operations: run one statement, run
a batch atomically, run a parameter-free script, and report the database size.

In REST mode reads and single writes go to the `/raw` endpoint, which returns
rows as arrays with a column list, batches use the documented `batch` body,
and scripts are sent as one semicolon-separated text. In bridge mode every
operation is one bridge request; a script is divided into its statements
locally because a bridge entry carries exactly one statement. That division
is a layout rule, not a SQL parser: the D1 scripts keep one statement per
paragraph, so a blank line is the boundary (see Schema and migrations).

Bound parameters travel as JSON numbers, strings, and nulls in both modes;
booleans become integers. Binary values cannot travel in JSON, so blob columns
are written with `unhex(?)` bound to hex text and read back through `hex(blob)`.

A thin `database/sql` adapter wraps the same transport so `Driver.GetDB()`
keeps working for the migrator and for tests. Its transactions buffer writes
and send them as one atomic request on commit. A read after a buffered write
is refused, because the write is not visible until the batch runs.

## Bridge protocol

Memos owns this protocol; the deployment repository owns the Worker that
implements it, its D1 binding, and its Wrangler configuration. The protocol
is one endpoint.

**Request.** `POST <bridge-url>` with `Content-Type: application/json` and,
when a secret is configured, `Authorization: Bearer <secret>`. The body is:

```json
{"statements": [{"sql": "INSERT INTO memo (uid) VALUES (?)", "params": ["m1"]},
                {"sql": "SELECT id, uid FROM memo WHERE uid = ?", "params": ["m1"]}]}
```

- `statements` holds one or more entries, each exactly one SQL statement.
  `params` is optional and binds positionally; values are JSON strings,
  numbers, or `null`. Memos never sends more than 100 parameters per entry.
- The Worker must run the entries in order as one transaction, which is what
  the binding's `batch()` provides: if any statement fails, none commits.

**Response.** `200 OK` with one result per statement, in order:

```json
{"results": [
  {"columns": [], "rows": [], "meta": {"changes": 1, "last_row_id": 7, "size_after": 8192}},
  {"columns": ["id", "uid"], "rows": [[7, "m1"]], "meta": {"changes": 0, "last_row_id": 7, "size_after": 8192}}
]}
```

- `columns` lists the result columns in order and `rows` holds one array per
  row in that order. A statement without a result set returns both empty.
  Cell values are JSON numbers, strings, or `null`; a blob is an array of byte
  values, though Memos reads blobs through `hex()` and never relies on it.
- `meta.changes` is the number of rows the statement modified,
  `meta.last_row_id` the last inserted rowid, and `meta.size_after` the
  database size in bytes after the batch committed. Memos reports the size
  through `size_after`, so a Worker that omits it makes the size unavailable
  rather than wrong.

**Errors.** Any failure is a non-200 status with a body of
`{"error": {"message": "<text>"}}`. The message must carry the D1 error text
verbatim, for example `D1_ERROR: UNIQUE constraint failed: space.uid`: the
driver recognises constraint failures and guard aborts by that text. A
missing or wrong bearer secret should answer `401`.

Memos never issues a query whose result has two columns of the same name, so
a Worker may build `columns` from the keys of the first row object that
`batch()` returns and `rows` from each row's values in that order.

A Worker that meets the contract serves the private path from the
Container's outbound handler and, if a public route is wanted as well, checks
the shared secret on `fetch`. A public route with no secret configured is
refused rather than left open:

```js
import { Container, ContainerProxy } from "@cloudflare/containers";
export { ContainerProxy };

async function runBatch(env, request) {
  const { statements } = await request.json();
  const prepared = statements.map((s) => env.DB.prepare(s.sql).bind(...(s.params ?? [])));
  try {
    const results = (await env.DB.batch(prepared)).map(({ results = [], meta }) => {
      const columns = results.length ? Object.keys(results[0]) : [];
      return {
        columns,
        rows: results.map((row) => columns.map((c) => row[c])),
        meta: { changes: meta.changes, last_row_id: meta.last_row_id, size_after: meta.size_after },
      };
    });
    return Response.json({ results });
  } catch (err) {
    return error(400, err.message);
  }
}

const error = (status, message) => Response.json({ error: { message } }, { status });

export class MemosContainer extends Container {
  defaultPort = 5230;
}

// Private path: plain HTTP from the container to http://d1.internal/d1 lands
// here, never on a public route, so no credential is needed.
MemosContainer.outboundByHost = {
  "d1.internal": (request, env) => runBatch(env, request),
};

// Public route: only for deployments that must reach the bridge from outside
// the container. It is closed until BRIDGE_SECRET is configured.
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return error(405, "method not allowed");
    if (!env.BRIDGE_SECRET) return error(503, "bridge secret is not configured");
    if (request.headers.get("Authorization") !== `Bearer ${env.BRIDGE_SECRET}`) {
      return error(401, "unauthorized");
    }
    return runBatch(env, request);
  },
};
```

## Atomicity without transactions

D1 offers two atomic units: a single statement, and a `batch` request whose
statements run in one transaction. Every driver method is shaped around them.

1. Validation reads run first, outside any transaction, and produce the
   store's documented errors (`ErrSpacePermissionDenied`,
   `ErrMemoMutationConflict`, and so on).
2. The writes are collected into one batch and committed together.
3. Preconditions the reads established are re-asserted inside the batch with
   guard statements. A guard inserts the value `0` into `d1_guard`, a table
   whose CHECK constraint rejects anything but `1`, but only when the guarded
   condition is false. The constraint failure aborts and rolls back the whole
   batch, and the driver maps it to the conflict error the caller expects.
   `d1_guard` never holds rows.

A batch runs its statements in order inside one transaction, so a later
statement sees the rows an earlier one inserted, but the generated ids are
only reported after the commit. Methods that need a new id inside the batch
use the unique natural key instead: a membership created with a new space
references `(SELECT id FROM space WHERE uid = ?)`, and the space is read back
by uid after the commit. Statements that return generated values through
`RETURNING` get them from the batch result, so a policy-checked insert can
sit behind its guards and still report its id.

Guards re-assert every fact a validation read established, not only the
row's existence: a memo's creator, lifecycle, audience, and placement, the
actor's memberships, and, where the caller computed the mutation from the
memo text, the content itself. A set of rows read before the batch, such as
the attachments a memo deletion returns for storage cleanup, is guarded on
its count together with its highest id, because ids only grow and a row
swapped for a newer one keeps the count equal.

## Schema and migrations

`store/migration/d1/LATEST.sql` is written for D1: the SQLite schema plus the
`d1_guard` table. D1 enforces foreign keys by default, as MySQL and PostgreSQL
do, so the `memo_share` cascade is declared. The directory carries no
incremental migrations: a D1 database can never be older than the schema
that introduced the driver, so `LATEST.sql` is the whole history. The
migrator reports the highest version any driver's migration directory
defines for such a driver, and future migrations are added as plain SQL
files under `store/migration/d1/<version>/` alongside the other drivers'.
They must avoid the `PRAGMA foreign_keys` toggles the SQLite migrations use,
which D1 ignores.

D1 scripts follow one layout rule: **one statement per paragraph**. A blank
line separates statements, and nothing inside a statement, including a table
or trigger body, a string literal, or a comment, may contain a blank line.
The bridge transport divides scripts at blank lines to send them as a batch,
and D1 refuses a bridge entry that holds more than one statement. The test
emulator refuses it too, judging statement boundaries with SQLite's own
`sqlite3_complete`, so a paragraph with two statements fails the store
suite's bridge run rather than a deployment.

## Operational limits

The emulator enforces the bind limit and the one-statement rule, but not the
service's size and rate limits, which a deployment must keep in mind:

- A bound string or blob may be at most 2 MB. Blobs travel as hex text, so an
  attachment stored in the database is limited to about 1 MB; larger
  attachments belong in local or S3 storage.
- A batch may hold on the order of a thousand statements. Deleting a user or
  a space removes its memos in chunks of ninety, so an account with many
  thousands of memos exceeds the batch and must be trimmed first.
- The REST API is subject to Cloudflare's account-wide rate limit of 1200
  requests per five minutes, after which every request is refused with a 429
  for the rest of the window. The driver does not retry a 429, since an
  immediate retry only extends the block. The bridge is a Worker request and
  is not subject to that limit.

## Filter dialect

`filter.DialectD1` renders like SQLite except that case folding uses the
built-in `LOWER()` (ASCII only, because the Unicode fold used by the SQLite
driver is a registered Go function) and `matches()` accepts only literal
patterns with optional anchors.

## Testing

`store/db/d1/d1test` emulates D1 in-process on a private SQLite database and
speaks both protocols: the REST API endpoints and the bridge endpoint, with
the same implicit transaction per request, atomic batches, foreign-key
enforcement, 100-parameter limit, and one-statement rule for prepared
entries, and no custom functions registered. Driver tests in
`store/db/d1/race_test.go` interpose on the transport to change the database
between a method's validation reads and its batch, which exercises the guards
the way a concurrent writer would.
`DRIVER=d1` runs the whole store suite against it over REST, and
`D1_ACCESS=bridge` runs it over the bridge protocol; the all-drivers loop
runs both. Setting `D1_DSN` points the suite at a real
database for spot checks.
