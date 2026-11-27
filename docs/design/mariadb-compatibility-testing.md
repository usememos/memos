# MariaDB compatibility testing

Status: Implemented in 26.11.2

Date: 2026-11-16

Related: [PR #6571](https://github.com/usememos/memos/pull/6571), [migration procedure](../../store/migration/README.md).

The [MariaDB upgrade check](https://github.com/usememos/memos/actions/runs/43883500298/job/133355326419) passed before release.
For current test commands and coverage, see the [store test guide](../../store/test/README.md).

## Decision and scope

Test MariaDB through the existing `mysql` application driver, SQL dialect, and migrations. Add a fourth database test target
alongside SQLite, MySQL, and PostgreSQL. Run the same store and upgrade tests against it.

MySQL remains the primary implementation target. Prefer SQL and metadata checks shared with MariaDB when they preserve
correctness, performance, and maintainability. A MySQL-specific feature needs a concrete benefit that justifies the compatibility
cost. Do not add server-version detection or a second SQL dialect for the differences identified here.

The initial MariaDB target is `mariadb:11.4.13`. The local `mariadb:11.4` image used for design probes reports that version.
Pin the patch tag in the test setup; keep the existing `mysql:8.4` target. MariaDB 11.4 has community maintenance through May 2029,
according to the [MariaDB maintenance policy](https://mariadb.org/about/).

The compatibility target is MariaDB 11.4.13 using `driver=mysql`. This does not establish compatibility with every MariaDB version,
MySQL-to-MariaDB database conversion, or cross-product replication.

This change covers test containers, confirmed SQL incompatibilities, CI, and contributor guidance. It adds no application driver,
schema version, migration directory, API, or user-facing configuration option.

## Audit baseline and confirmed gaps

The source inspection used main at `bdc41c236`, which includes #6571.

- `store/test/main_test.go` runs three driver subprocesses when `DRIVER` is empty. An explicit `DRIVER` runs one suite.
- `GetMySQLDSN` starts one shared MySQL 8.4 container and creates an isolated database for each test.
- Released-binary upgrade tests also connect to that container through the Docker network alias `memos-mysql`.
- Backend Tests invokes the aggregate store run. Upgrade Smoke has a three-driver matrix and is also called by Release.
- `requireLookupIndexes` still queries `IS_VISIBLE`, even though #6571 removed it from the migration.
- `filter/render.go` casts JSON boolean literals with `CAST(... AS JSON)`.
- `store/db/mysql/memo.go` uses the same cast for tags and property objects in `RefreshMemoDerivedPayload`.
- `ListSpaces` selects `space.payload` without grouping it. MySQL accepts the primary-key functional dependency; MariaDB
  rejects the query when `ONLY_FULL_GROUP_BY` is enabled.
- `store/user_unique.go` relies on `user_identity` in the constraint target. MariaDB reports the bare index names `provider`
  and `user_id`, so identity conflicts are not classified as `ErrUserIdentityTaken`.

Direct SQL probes against MySQL 8.4 and MariaDB 11.4.13 confirmed that MariaDB rejects `CAST('true' AS JSON)` with error 1064.
Both servers accept `JSON_EXTRACT(document, '$')`. In the probes, it preserves nested arrays and objects passed to `JSON_SET`.
Using it for boolean constants also gives the same results for true, false, missing values, JSON null, the string `"true"`, and
the number 1. The broader audit and suite results are recorded below. These initial diagnostic overlays did not change repository
source files; the implementation now uses the shared expressions and container selector described here.

See the [MariaDB CAST reference](https://mariadb.com/docs/server/reference/sql-functions/string-functions/cast) and
[JSON_EXTRACT reference](https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_extract).

## SQL audit coverage and results

The audit covered all 26 production Go files in `store/db/mysql`, every current MySQL schema and migration file, the store-level
migration executor and unique-error classifier, and the MySQL SQL emitted by `filter/render.go` and `filter/schema.go`.

| Source | Reviewed behavior | Result on the audited versions |
| --- | --- | --- |
| `store/migration/mysql/LATEST.sql` | All 13 tables, indexes, JSON columns, CHECK constraints, timestamp expression defaults, and share foreign key | Complete script applies on both servers; Unicode content round-trips; invalid JSON and member roles are rejected; deleting a memo cascades to its shares |
| Both incremental MySQL migration files | Creator indexes and attachment lookup index, including upgrade and retry paths | Upgrade suites execute them; the remaining `IS_VISIBLE` failure is in the test assertion |
| `mysql.go`, `common.go`, `executor.go` | DSN merging, metadata queries, multi-statement execution, JSON decoding, and executor interfaces | No additional SQL incompatibility found |
| `user.go`, `user_identity.go` | User CRUD, unique nullable email, identity transactions, generated IDs, and admin retention | Existing store behavior tests pass after the three initial overlay corrections; stronger identity-error assertions expose an additional classifier gap |
| `user_delete.go`, `space_delete.go` | Batched deletes, relationship cleanup, and parent row locking | Existing data-preservation and concurrency tests pass on MariaDB |
| `space.go` | Membership lifecycle, summaries, aggregates, pagination, and locks | Default mode passes; two existing Space tests fail under `ONLY_FULL_GROUP_BY`; explicitly grouping payload fixes those tests |
| `memo.go`, `memo_attachment.go` | Memo CRUD, guarded payload refresh, attachment binding, timestamps, and serializable mutations | JSON casts need replacement; remaining tested operations pass |
| `memo_access.go`, `memo_policy.go`, `memo_delete_policy.go`, `memo_comment.go`, `memo_relation_policy.go` | Access predicates, EXISTS queries, authorization snapshots, subtree traversal, and locking | No additional SQL incompatibility found in source or existing MariaDB tests |
| `attachment.go`, `attachment_delete.go`, `memo_relation.go`, `memo_share.go` | Attachment queries and updates, filters, relation upserts, shares, limits, and usage sums | Existing MariaDB tests pass, including binary content guards and relation cleanup |
| `reaction.go`, `reaction_policy.go` | INSERT SELECT with LOCK IN SHARE MODE, upserts, readback, and participation checks | Existing MariaDB tests pass, including concurrent memo deletion |
| `auth_config.go`, `instance_setting.go`, `idp.go` | FOR UPDATE, serializable configuration mutations, INSERT IGNORE, ON DUPLICATE KEY UPDATE, affected-row handling, and binary compare-and-swap | Existing MariaDB tests pass; retry detection still uses errors 1205 and 1213 |
| `user_setting.go`, `inbox.go` | JSON_SEARCH for PAT hashes and JSON_EXTRACT comparisons for inbox enums | Existing MariaDB tests and direct SQL probes pass |
| `filter/render.go`, `filter/schema.go` | JSON booleans, existence, JSON_TABLE tag comprehensions, binary tag matching, size, related-row predicates, string filters, regex, resource expressions, and date accessors | Boolean casts need replacement; existing execution tests pass with the candidate expressions |
| `store/user_unique.go` | Mapping database uniqueness errors to typed store errors | MariaDB identity constraints need recognition without the MySQL table qualifier |

### Diagnostic runs

The audit used MySQL 8.4.11 from `mysql:8.4` and MariaDB 11.4.13 from `mariadb:11.4`. Temporary `go test -overlay` files changed
the test image and candidate expressions without editing application or test source in the worktree.

- With only the image replaced, `DRIVER=mysql go test -v -count=1 -timeout 30m ./store/...` reported 13 failing top-level tests.
  The reported causes were `IS_VISIBLE` in the test assertion and the two production JSON-cast sites.
- With those three sites corrected in an overlay, the same command passed on MariaDB. Across the store packages, 388 top-level
  tests passed; existing driver-specific and opt-in skips remained. Released `0.30.0` through `0.31.0` upgrades and direct
  `0.31.0` upgrades both passed.
- The same candidate SQL and index assertion passed the full store run on MySQL 8.4.11 as well, with 388 top-level passes.
- Enabling `ONLY_FULL_GROUP_BY` reproduced failures in `TestSpaceStoreMembershipGuards` and
  `TestSpaceStoreInvitationLifecycle`. Adding `space.payload` to the grouping clause made the focused Space selection pass.
- Strengthening the existing identity conflict assertions from `require.Error` to `require.ErrorIs` exposed failures in
  `TestUserIdentityUniqueConflict`, `TestUserIdentitySameUserSameProviderConflicts`, and the identity-conflict subtest of
  `TestCreateUserWithIdentityIsAtomic`. The strengthened selection passed on MySQL. Username classification still passed on MariaDB.

The existing suite becoming green after three corrections does not settle compatibility: the stricter SQL mode and typed-error
checks found gaps outside its original assertions. Final acceptance includes those stronger checks.

### Differences to retain in the compatibility boundary

Both audited images defaulted to InnoDB and utf8mb4, but their table collations differed: MySQL used `utf8mb4_0900_ai_ci`, while
MariaDB used `utf8mb4_uca1400_ai_ci`. Username and email already specify `utf8mb4_bin`; tag comparisons and payload content guards
use explicit binary comparisons. Keep those exact comparisons. Do not introduce a collation migration to make all text ordering
identical. Document utf8mb4 and InnoDB as deployment requirements rather than assuming every MariaDB installation has the
audited image's defaults.

MariaDB's JSON implementation differs from MySQL's, but the current JSON column declarations preserve validation on both.
Keep the schema's JSON types. The audited defaults, constraints, and indexes do not require a `LATEST.sql` change or a new migration.

The existing REGEXP operator uses different regex engines across database products. Common patterns pass the existing tests;
Unicode category and boundary semantics are not established as identical. Likewise, date accessors continue to use the database
session timezone. These are documented portability limits, not reasons to silently change filter semantics or remove features.
See [MariaDB REGEXP](https://mariadb.com/docs/server/reference/sql-functions/string-functions/regular-expressions-functions/regexp)
and [MySQL grouping behavior](https://dev.mysql.com/doc/refman/8.4/en/group-by-handling.html).

## Test target selection

Keep `DRIVER` as the application driver. Add a test-only selector `MYSQL_VARIANT`, with `mysql` as its default and `mariadb` as
the other accepted value.

| Target label | DRIVER | MYSQL_VARIANT | Container |
| --- | --- | --- | --- |
| sqlite | sqlite | unset | none |
| mysql | mysql | mysql | mysql:8.4 |
| mariadb | mysql | mariadb | mariadb:11.4.13 |
| postgres | postgres | unset | postgres:18 |

An explicit MySQL run without `MYSQL_VARIANT` retains its current behavior. Reject unknown variants before starting containers.
The selector only controls the MySQL test fixture. It never changes `Profile.Driver`, filter dialect selection, or `MEMOS_DRIVER`.

The default aggregate run adds a `mariadb` entry. Each subprocess receives explicit selector values, including an empty value
for non-MySQL targets, so an inherited environment cannot turn the MySQL run into a second MariaDB run. Labels and startup
logs identify the selected server and image. MariaDB errors must fail that run; they must not select MySQL as a fallback.

## Container setup and upgrade connectivity

Use the [Testcontainers MariaDB module](https://golang.testcontainers.org/modules/mariadb/), pinned to `v0.44.0` to match the
existing Testcontainers dependencies. It handles MariaDB credentials and startup behavior. This adds a test module, with no
new application database driver or Testcontainers upgrade.

Extend `GetMySQLDSN` to select the appropriate container startup branch. Reuse database creation, the existing SQL connection
check, and `multiStatements=true`. Preserve one selected server per test process and one database per test. Clean up the selected
container and network through the existing teardown path, including partially started containers when startup returns an error.

Enable `ONLY_FULL_GROUP_BY` for the MariaDB fixture while retaining its strict-mode settings. MySQL already enables this check
by default. This keeps the shared queries from relying on MariaDB's looser default grouping rules without adding another CI target.

Give either server the existing `memos-mysql` network alias. The variant runs in a separate process and network, so the alias
does not conflict. `getContainerDSN` can retain its MySQL address rewrite, and released Memos containers continue to receive
`MEMOS_DRIVER=mysql`. Verify both host-to-database and Memos-container-to-database connections.

Do not duplicate the upgrade fixtures or add MariaDB cases to every application-driver switch.

## SQL changes and behavior to preserve

### Index assertions

The attachment index migration adds a performance index. It does not audit an operator's existing index definition or implement
a separate migration recovery mechanism. MySQL uses ordinary `CREATE INDEX`, matching the 26.10 scripts. SQLite and PostgreSQL
use `CREATE INDEX IF NOT EXISTS`. The index declarations are the same as before.

The migrator skips files whose schema version is already recorded, so a completed upgrade can restart. MySQL commits DDL before
the version marker; an interrupted migration may therefore require manual inspection and recovery. That affects MySQL migrations
generally and is not solved specially in the 26.11 script. See [MySQL CREATE INDEX](https://dev.mysql.com/doc/refman/8.4/en/create-index.html).

Remove `IS_VISIBLE` from the test assertion, matching #6571. Fresh-install and ordinary upgrade tests still check ordered columns,
full-column coverage, non-unique status, and BTREE structure. The attachment migration test starts with the index absent, upgrades,
verifies preserved data and the schema marker, then verifies a restart. It no longer claims recovery for partial DDL or custom
index definitions. There is no invisible-index branch in the migration or tests.

### JSON boolean filters

Replace JSON literal casts with `JSON_EXTRACT('true', '$')` and `JSON_EXTRACT('false', '$')` in the MySQL renderer. Preserve the
existing `COALESCE` and negation behavior. A missing flag counts as false, and `flag == false` matches the same memos as `!flag`.
The change also applies to the payload half of `has_image`.

Update the nearby SQL expectation tests. Extend existing store filter tests only where needed to verify actual database behavior,
including explicit JSON null and false values. Do not replace boolean comparisons with loose numeric or string coercion.

### Derived payload refresh

Replace `CAST(? AS JSON)` with `JSON_EXTRACT(?, '$')` for tags and property values in `RefreshMemoDerivedPayload`.
Keep the single guarded `UPDATE`, binary content comparison, and partial `JSON_SET` update. Tags must remain an array and property
an object; a refresh must preserve unrelated payload keys and timestamps and must not overwrite a concurrent content edit.

Reuse `TestRefreshMemoDerivedPayload`, which already covers these user-visible guarantees. Add a type assertion only if the
existing round-trip assertions do not expose an array or object accidentally stored as a string.

### Space aggregation

Include `space.payload` in `ListSpaces`' grouped columns. It is already selected, and the primary key keeps each Space as one
group, so the change preserves the intended result on both servers. Keep member counting and current-user role behavior.
Run the existing Space tests with the MariaDB fixture's strict grouping mode enabled.

### Identity constraint errors

Recognize MariaDB's unqualified identity index names in the unique-error classifier. Restrict matching to the constraint target
and known identity indexes; duplicate values must not affect classification. Keep the existing typed-error API and transactional
rollback behavior. No constraint renaming or schema migration is needed.

Strengthen the existing identity-conflict tests to require `ErrUserIdentityTaken` and the atomic username-conflict test to require
`ErrUsernameTaken`. Add the observed MariaDB error strings to `store/user_unique_test.go` alongside the MySQL fixtures.

Run the full suite to find further differences. Record each failure before deciding on a shared fix. Do not skip failing MariaDB
behavior tests to make the target green or broaden this change into speculative SQL cleanup.

## CI and release checks

Keep the existing Backend Tests store job. Its aggregate invocation will run four targets sequentially. This is the smallest CI
change; measure the added duration before deciding whether separate database jobs are worthwhile. Add `store/migration/**` to
its pull-request paths so SQL-only changes also run the full store suite.

Expand Upgrade Smoke to four named targets using explicit driver and variant values from the table above. Include the new
selector's entry point, dependency manifests, and filter implementation in its pull-request paths. Keep the existing migration
and released-binary upgrade selection.

MariaDB failures should block the same checks as the other tested targets once all suites pass. Upgrade Smoke is reused by Release,
so this also adds MariaDB to the release prerequisite. This is an intended change to the release gate. It requires no edit to
`release.yml`, Dockerfiles, image publication, or release scripts. The separate release-image smoke test retains its current scope.

## Implementation files

| Files | Change |
| --- | --- |
| `store/test/containers.go` | Select MySQL or MariaDB, preserve host/network DSNs, and clean up both startup branches |
| `store/test/main_test.go` | Add the MariaDB aggregate target and validate the test selector |
| `go.mod`, `go.sum` | Add the matching MariaDB Testcontainers module |
| `store/test/migrator_test.go` | Align index assertions with the shared migration contract |
| `store/migration/{sqlite,mysql,postgres}/26.11/00__add_attachment_memo_index.sql` | Use ordinary index creation without definition auditing or special recovery |
| `store/test/migrator_attachment_index_test.go` | Cover index creation, data preservation, and restart after a completed upgrade |
| `filter/render.go`, `filter/engine_test.go`, `filter/README.md` | Use shared JSON expressions and update expectations and guidance |
| `store/db/mysql/memo.go` | Preserve structured JSON in derived payload updates using shared SQL |
| `store/db/mysql/space.go` | Explicitly group the selected payload column |
| `store/user_unique.go`, `store/user_unique_test.go` | Recognize unqualified MariaDB identity index names |
| `store/test/user_identity_test.go` | Assert typed conflict errors as well as transaction rollback |
| `store/test/memo_filter_test.go` | Fill any gaps in boolean/null behavior coverage |
| `store/test/memo_payload_refresh_test.go` | Extend only if needed to detect JSON type regressions |
| `.github/workflows/backend-tests.yml` | Update target comments and migration path coverage |
| `.github/workflows/upgrade-smoke.yml` | Add the MariaDB target and relevant trigger paths |
| `store/test/README.md`, `AGENTS.md` | Document commands, tested scope, and the shared-SQL preference |
| `store/migration/README.md`, `docs/design/memo-attachment-filters.md` | Document the simpler index migration contract |

`store/test/store.go` and `migrator_upgrade_test.go` should keep their existing driver dispatch. Update their comments only if
needed. The existing attachment index migration is simplified on all three drivers. It creates the same indexes, so there is no
new schema version, new migration, or `LATEST.sql` edit.

## Implementation order and acceptance

1. Add the selector and container fixture locally, including strict grouping mode. Reproduce the audited failures using the real fixture.
2. Fix the index assertion, JSON expressions, Space grouping, and identity-error classification. Run focused tests on MySQL and
   MariaDB, then the full store suites with the stronger conflict assertions.
3. Add the CI target and contributor guidance after both suites pass. Verify SQLite and PostgreSQL through the aggregate run.
4. Run the upgrade selection against all four targets, including released `0.30.0` through `0.31.0` and direct `0.31.0` upgrades.
   A historical-binary failure must be investigated and documented rather than silently removed from MariaDB coverage.

Planned verification commands, from the repository root:

```bash
DRIVER=mysql MYSQL_VARIANT=mysql go test -v -count=1 -run 'TestMigrationAttachmentIndex|TestRefreshMemoDerivedPayload|TestMemoFilter|TestSpaceStore|TestListSpaces|TestUserIdentity|TestCreateUserWithIdentity' ./store/test/...
DRIVER=mysql MYSQL_VARIANT=mariadb go test -v -count=1 -run 'TestMigrationAttachmentIndex|TestRefreshMemoDerivedPayload|TestMemoFilter|TestSpaceStore|TestListSpaces|TestUserIdentity|TestCreateUserWithIdentity' ./store/test/...
go test -v -race ./filter/...
go test -v ./store/...
DRIVER=mysql MYSQL_VARIANT=mariadb go test -v -count=1 -timeout 30m -run 'TestMigration|TestUpgrade|TestFreshInstall' ./store/test/...
go mod tidy -go=1.27.4
go fix -diff ./...
golangci-lint run
git diff --check
```

Run the upgrade selection with the SQLite, MySQL, and PostgreSQL target environments as well. Acceptance requires the full store
suite on each target, strict grouping and typed conflict-error checks, data preservation and restart checks on upgrades, and no
MySQL behavior regression. Passing the diagnostic overlays alone does not satisfy implementation acceptance. Record suite
results and CI duration when implementation is complete.

## Implementation verification

Local verification completed on 2026-11-16 using the implementation, without diagnostic overlays:

| Check | Result |
| --- | --- |
| Full `./store/...` suite with `DRIVER=sqlite` | Passed |
| Full `./store/...` suite with `DRIVER=mysql MYSQL_VARIANT=mysql` | Passed |
| Full `./store/...` suite with `DRIVER=mysql MYSQL_VARIANT=mariadb` | Passed, with ONLY_FULL_GROUP_BY enabled |
| Full `./store/...` suite with `DRIVER=postgres` | Passed |
| Fresh installs, attachment index upgrades, released 0.30.0 through 0.31.0 upgrades, and direct 0.31.0 upgrades | Passed on all four targets as part of their full suites |
| `go test -v -race ./server/... ./core/...` | Passed |
| `go test -v -race ./markdown/... ./filter/... ./provider/...` | Passed |
| golangci-lint v2.14.0 built with the repository's Go toolchain | Passed, zero issues |
| `go fix -diff ./...`, `go mod tidy -go=1.27.4`, and `git diff --check` | Passed |
| Workflow YAML and four-target matrix validation | Passed |
| Unknown MYSQL_VARIANT | Rejected before container startup |

The aggregate selector was also exercised with an inherited MariaDB variant and ran all four database targets. Final store
suites were run separately after simplifying the index scripts. Local parallel runs of `store/test` took approximately 39 seconds
for SQLite, 259 seconds for MySQL, 221 seconds for MariaDB, and 149 seconds for PostgreSQL; these are not CI timing measurements.
GitHub Actions execution remains to be verified after pushing the change.
