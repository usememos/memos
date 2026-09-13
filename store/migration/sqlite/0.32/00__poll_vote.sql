-- Poll votes. Poll definitions (question/options/type) live inline in memo
-- Markdown content as a fenced ```poll block keyed by a client-generated
-- poll UID; only the votes themselves are persisted server-side, keyed by
-- that UID.
-- IF NOT EXISTS guards this migration: a brand-new installation already gets
-- poll_vote from LATEST.sql, so an upgrade path that replays every
-- migration since an older tracked schema version (as opposed to starting
-- fresh) must not fail when this file runs a second time.
CREATE TABLE IF NOT EXISTS poll_vote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  poll_uid TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  UNIQUE(poll_uid, voter_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_poll_vote_poll_uid ON poll_vote(poll_uid);
