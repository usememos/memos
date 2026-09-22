# Database migration baseline

The minimum supported database schema is **0.31.8**, shipped in **v0.31.0**.
This is a fixed baseline, independent of application release numbering.

- Fresh installations use the driver's `LATEST.sql` and record the current schema version.
- Existing databases below the baseline must first run
  [v0.31.0](https://github.com/usememos/memos/releases/tag/v0.31.0) successfully.
- Databases older than v0.22, or with no schema version recorded, must first run
  [v0.25.3](https://github.com/usememos/memos/releases/tag/v0.25.3), then v0.31.0.
- Invalid schema versions and databases newer than the binary supports are rejected.

Historical SemVer migration scripts are retained in Git history and released
binaries. They are no longer embedded in the current binary. Keep each driver's
`LATEST.sql` for fresh installations and add incremental migrations for future
schema changes across SQLite, MySQL, and PostgreSQL. Do not advance the baseline
when adding migrations; databases at 0.31.8 must remain upgradeable.

New migrations use `YY.MM/NN__description.sql`, where `NN` starts at `00`.
Each schema change ships one file per driver under the same `YY.MM/NN`; a
driver only records versions whose SQL it executed, and the store tests fail
when drivers disagree. Two files with the same `NN` in one month are rejected.
For example, `26.09/00__add_column.sql` records schema `26.9.1`; the next
migration records `26.9.2`. Compare year, month, and sequence numerically.
The sequence is independent of the application's release revision: a release
without schema changes keeps the existing schema version. Calendar schemas
sort after the legacy 0.x baseline. Migration directories keep months zero-padded
(`01` through `12`), while stored schema markers omit the padding. This lets older binaries' SemVer comparisons
recognize a calendar schema as newer and reject a downgrade.
