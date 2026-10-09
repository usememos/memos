# Store tests

Run from the repository root. Docker must be running for MySQL, PostgreSQL, and released-binary upgrade tests.

```bash
go test -v ./store/... # SQLite, MySQL, and PostgreSQL; TestContainers creates isolated databases
DRIVER=mysql go test -v ./store/test/... # One driver only
```

## Upgrade coverage

```bash
DRIVER=sqlite go test -v -count=1 -timeout 30m -run 'TestMigration|TestUpgrade|TestFreshInstall' ./store/test/...
```

Use `DRIVER=mysql` or `DRIVER=postgres` for the other drivers. The existing Upgrade Smoke workflow runs this selection for
all three drivers before release.

- Before `v0.31.0`: `TestUpgradeThroughBaselineRelease` initializes a database with released `0.30.0`, verifies the current
  migrator refuses a direct upgrade without modifying data or settings, then upgrades through released `0.31.0` to current.
- From `v0.31.0`: `TestUpgradeFromBaselineRelease` initializes a database with released `0.31.0`, then checks preservation of
  the account, memo, saved View, and access mode, post-upgrade writes, and reopening the database after upgrade.
- From CalVer: `TestUpgradeFromCalendarRelease` uses local store fixtures for month changes, point releases, RC promotion,
  and year changes. It checks the same preservation and restart behavior. These are fixtures, not published CalVer binaries;
  application versions advance while the current database schema remains `0.31.8`.
