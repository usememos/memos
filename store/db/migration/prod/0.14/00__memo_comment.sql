CREATE TABLE memo_comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  content TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT DEFAULT '',
  name TEXT NOT NULL DEFAULT 'UNKNOWN',
  memo_id INTEGER NOT NULL,
  parent_id INTEGER DEFAULT (0)
);

CREATE INDEX idx_memo_id ON memo_comment (
    memo_id
);
