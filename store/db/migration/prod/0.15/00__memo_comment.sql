CREATE TABLE memo_comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  content TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT 'UNKNOWN',
  memo_id INTEGER NOT NULL
);

CREATE INDEX idx_memo_content_memo_id ON memo_comment (
    memo_id
);
