CREATE TABLE habit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL,
  identity TEXT NOT NULL DEFAULT '',
  cue TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT '',
  minimum_value INTEGER NOT NULL CHECK (minimum_value > 0),
  target_value INTEGER NOT NULL CHECK (target_value >= minimum_value),
  start_date TEXT NOT NULL
);
CREATE INDEX idx_habit_creator_id ON habit(creator_id, id);
CREATE TABLE habit_log (
  habit_id INTEGER NOT NULL,
  log_date TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0),
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (habit_id, log_date),
  FOREIGN KEY (habit_id) REFERENCES habit(id) ON DELETE CASCADE
);
