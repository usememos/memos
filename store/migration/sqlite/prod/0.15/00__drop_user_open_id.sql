DROP TABLE IF EXISTS user_temp;

CREATE TABLE user_temp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('HOST', 'ADMIN', 'USER')) DEFAULT 'USER',
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT ''
);

INSERT INTO
  user_temp (id, created_ts, updated_ts, row_status, username, role, email, nickname, password_hash, avatar_url)
SELECT
  id, created_ts, updated_ts, row_status, username, role, email, nickname, password_hash, avatar_url
FROM
  user;

DROP TABLE user;

ALTER TABLE user_temp RENAME TO user;
