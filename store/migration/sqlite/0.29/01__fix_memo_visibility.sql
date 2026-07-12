-- Fix memo visibility constraint to allow 'GROUP'
-- Note: Transaction is handled by Memos migrator

-- Create a temporary table with the updated constraint
CREATE TABLE memo_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE', 'GROUP')) DEFAULT 'PRIVATE',
  group_id INTEGER DEFAULT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}'
);

-- Copy data from the old table to the new one
INSERT INTO memo_new (id, uid, creator_id, created_ts, updated_ts, row_status, content, visibility, group_id, pinned, payload)
SELECT id, uid, creator_id, created_ts, updated_ts, row_status, content, visibility, group_id, pinned, payload FROM memo;

-- Drop the old table
DROP TABLE memo;

-- Rename the new table to the original name
ALTER TABLE memo_new RENAME TO memo;
