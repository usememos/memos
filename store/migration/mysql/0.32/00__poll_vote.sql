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
-- Indexes are declared inline (not as separate CREATE INDEX statements,
-- unlike some older migrations in this directory) so this file's entire
-- effect is covered by CREATE TABLE IF NOT EXISTS: MySQL, unlike SQLite and
-- PostgreSQL, has no IF NOT EXISTS form of CREATE INDEX, and a brand-new
-- installation already gets both tables (indexes included) from LATEST.sql,
-- so an upgrade path that replays every migration since an older tracked
-- schema version (as opposed to starting fresh) must not fail when this
-- file runs a second time.
CREATE TABLE IF NOT EXISTS `poll` (
  `id`              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts`      BIGINT       NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `uid`             VARCHAR(256) NOT NULL UNIQUE,
  `memo_id`         INT          NOT NULL,
  `definition_hash` VARCHAR(256) NOT NULL,
  KEY `idx_poll_memo_id` (`memo_id`)
);

CREATE TABLE IF NOT EXISTS `poll_vote` (
  `id`           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_ts`   BIGINT       NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  `poll_uid`     VARCHAR(256) NOT NULL,
  `memo_id`      INT          NOT NULL,
  `option_index` INT          NOT NULL,
  `voter_id`     INT          NOT NULL,
  UNIQUE(`poll_uid`, `voter_id`, `option_index`),
  KEY `idx_poll_vote_poll_uid` (`poll_uid`),
  KEY `idx_poll_vote_memo_id` (`memo_id`)
);
