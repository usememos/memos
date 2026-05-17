-- widen memo.row_status CHECK to allow the 'DRAFT' lifecycle state.
PRAGMA foreign_keys = off;

DROP TABLE IF EXISTS _memo_old;

ALTER TABLE
  memo RENAME TO _memo_old;

CREATE TABLE memo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED', 'DRAFT')) DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE')) DEFAULT 'PRIVATE',
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO
  memo (
    id,
    uid,
    creator_id,
    created_ts,
    updated_ts,
    row_status,
    content,
    visibility,
    pinned,
    payload
  )
SELECT
  id,
  uid,
  creator_id,
  created_ts,
  updated_ts,
  row_status,
  content,
  visibility,
  pinned,
  payload
FROM
  _memo_old;

DROP TABLE IF EXISTS _memo_old;

PRAGMA foreign_keys = on;
