ALTER TABLE user RENAME TO user_old;

CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER',
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

INSERT INTO user (
  id, created_ts, updated_ts, row_status, username, role, email, nickname, password_hash, avatar_url, description
)
SELECT
  id, created_ts, updated_ts, row_status, username, role, email, nickname, password_hash, avatar_url, description
FROM user_old;

DROP TABLE user_old;
