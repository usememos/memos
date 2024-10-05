-- webhook
CREATE TABLE webhook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  creator_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL
);

CREATE INDEX idx_webhook_creator_id ON webhook (creator_id);
