CREATE TABLE space (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE space_member (
  space_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
  PRIMARY KEY (space_id, user_id)
);

-- SQLite requires a table rebuild to extend the visibility CHECK constraint.
-- Copy every existing memo value verbatim; placement starts Unassigned.
CREATE TABLE memo_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE', 'SPACE')) DEFAULT 'PRIVATE',
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}',
  space_id INTEGER DEFAULT NULL
);

INSERT INTO memo_new (
  id, uid, creator_id, created_ts, updated_ts, row_status, content,
  visibility, pinned, payload, space_id
)
SELECT
  id, uid, creator_id, created_ts, updated_ts, row_status, content,
  visibility, pinned, payload, NULL
FROM memo;

-- Preserve the largest ID ever issued, including IDs belonging to deleted
-- memos that were not copied into the rebuilt table.
INSERT INTO sqlite_sequence (name, seq)
SELECT 'memo_new', seq
FROM sqlite_sequence
WHERE name = 'memo'
  AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'memo_new');

UPDATE sqlite_sequence
SET seq = MAX(seq, (SELECT seq FROM sqlite_sequence WHERE name = 'memo'))
WHERE name = 'memo_new';

DROP TABLE memo;
ALTER TABLE memo_new RENAME TO memo;

-- Recreate the pre-existing index dropped with the rebuilt memo table.
CREATE INDEX idx_memo_creator_id ON memo(creator_id);
CREATE INDEX idx_space_member_user_id ON space_member(user_id, space_id);
CREATE INDEX idx_memo_space_id ON memo(space_id, row_status, created_ts DESC, id DESC);
CREATE INDEX idx_memo_relation_related_type_memo
  ON memo_relation(related_memo_id, type, memo_id);
