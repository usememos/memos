# Store tests

Run from the repository root. Docker must be running for MySQL, MariaDB, PostgreSQL, and released-binary upgrade tests.

```bash
go test -v ./store/... # SQLite, MySQL, MariaDB, PostgreSQL; isolated databases per test
DRIVER=mysql go test -v ./store/test/... # MySQL 8.4
DRIVER=mysql MYSQL_VARIANT=mariadb go test -v ./store/test/... # MariaDB 11.4.13
```

MariaDB uses the application's `mysql` driver, dialect, and migrations. `MYSQL_VARIANT` is test-only; accepted values are `mysql`
(the default) and `mariadb`. The aggregate run sets each target explicitly, regardless of an inherited variant. The MariaDB
container enables `ONLY_FULL_GROUP_BY` alongside its strict SQL mode so shared queries are checked under strict grouping rules.

MariaDB 11.4.13 is the tested compatibility target. Deployments need InnoDB and utf8mb4. Other MariaDB versions, database conversion
between MySQL and MariaDB, and replication between them are outside this coverage. Text ordering and regex behavior can differ;
timestamp accessors use the database session timezone. Exact tag and content-guard comparisons retain explicit binary semantics.

## Upgrade coverage

```bash
DRIVER=sqlite go test -v -count=1 -timeout 30m -run 'TestMigration|TestUpgrade|TestFreshInstall' ./store/test/...
```

Use `DRIVER=mysql`, `DRIVER=mysql MYSQL_VARIANT=mariadb`, or `DRIVER=postgres` for the other database targets. Upgrade Smoke runs
this selection for all four targets before release. Both ordinary store tests and upgrade tests use the selected container,
including the private-network connection from released Memos binaries.

- Before `v0.31.0`: `TestUpgradeThroughBaselineRelease` initializes a database with released `0.30.0`, verifies the current
  migrator refuses a direct upgrade without modifying data or settings, then upgrades through released `0.31.0` to current.
- From `v0.31.0`: `TestUpgradeFromBaselineRelease` initializes a database with released `0.31.0`, then checks preservation of
  the account, memo, saved View, and access mode, post-upgrade writes, and reopening the database after upgrade.
- From CalVer: `TestUpgradeFromCalendarRelease` uses local store fixtures for month changes, point releases, RC promotion,
  and year changes. It checks the same preservation and restart behavior. These are fixtures, not published CalVer binaries;
  application versions advance while the database schema changes only with migrations.
