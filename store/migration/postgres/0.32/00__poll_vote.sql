-- Poll votes. Poll definitions (question/options/type) live inline in memo
-- Markdown content as a fenced ```poll block keyed by a client-generated
-- poll UID; only the votes themselves are persisted server-side.
--
-- The `poll` table binds each poll UID to the single memo that first
-- established it (so a UID copy/pasted into a second memo can be rejected
-- instead of sharing votes across memos) and a hash of its current
-- definition (type + options), so an edit that reorders or relabels options
-- can be detected and the now-stale votes cleared rather than silently
-- reassigned to different option labels.
--
-- IF NOT EXISTS guards this migration: a brand-new installation already gets
-- both tables from LATEST.sql, so an upgrade path that replays every
-- migration since an older tracked schema version (as opposed to starting
-- fresh) must not fail when this file runs a second time.
CREATE TABLE IF NOT EXISTS poll (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  uid TEXT NOT NULL UNIQUE,
  memo_id INTEGER NOT NULL,
  definition_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poll_memo_id ON poll(memo_id);

CREATE TABLE IF NOT EXISTS poll_vote (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  poll_uid TEXT NOT NULL,
  memo_id INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  UNIQUE(poll_uid, voter_id, option_index)
);

CREATE INDEX IF NOT EXISTS idx_poll_vote_poll_uid ON poll_vote(poll_uid);
CREATE INDEX IF NOT EXISTS idx_poll_vote_memo_id ON poll_vote(memo_id);
