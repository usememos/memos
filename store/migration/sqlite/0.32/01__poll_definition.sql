-- Fixes a database that already recorded schema version 0.32.1 from this
-- driver's original poll_vote-only migration (0.32/00, restored above to its
-- originally-shipped content). A later change added a `poll` binding table
-- and a `memo_id` column to poll_vote (for memo-deletion cleanup - see
-- store/db/sqlite/memo.go) by editing 0.32/00 in place instead of adding a
-- new migration. That has no effect on a database that already recorded
-- 0.32.1: schema version tracking is a monotonic per-version marker, not a
-- per-file-content hash, so an already-applied file never re-runs. This
-- migration - strictly newer at 0.32.2 - is what actually reaches such a
-- database and brings it in line with LATEST.sql.
--
-- Pre-existing poll_vote rows predate memo_id entirely (the schema they were
-- written under never tracked which memo a vote's poll belonged to), so
-- there is no data to backfill memo_id from. Dropping and recreating the
-- table (rather than ALTER TABLE ADD COLUMN) discards them and, unlike a
-- bare ADD COLUMN, stays replay-safe: a database whose schema version gets
-- rolled back and re-migrated (a real path - see
-- TestMigrationRepairsPollSchemaAfterInPlaceEdit and the pre-existing
-- TestMigrationSpaceMemberStatusBackfillsActive, which does exactly this for
-- an unrelated table) may already have a poll_vote with memo_id from
-- LATEST.sql, and re-running ADD COLUMN against that errors ("duplicate
-- column name").
DROP TABLE IF EXISTS poll_vote;

CREATE TABLE poll_vote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  poll_uid TEXT NOT NULL,
  memo_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  UNIQUE(poll_uid, voter_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_poll_vote_poll_uid ON poll_vote(poll_uid);
CREATE INDEX IF NOT EXISTS idx_poll_vote_memo_id ON poll_vote(memo_id);

CREATE TABLE IF NOT EXISTS poll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  uid TEXT NOT NULL UNIQUE,
  memo_id INTEGER NOT NULL,
  definition_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poll_memo_id ON poll(memo_id);
