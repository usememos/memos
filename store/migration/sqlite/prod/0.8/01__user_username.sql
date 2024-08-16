-- add column username TEXT NOT NULL UNIQUE
-- rename column name to nickname
-- add role `ADMIN`
DROP TABLE IF EXISTS _user_old;

ALTER TABLE
  user RENAME TO _user_old;

-- user
CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('HOST', 'ADMIN', 'USER')) DEFAULT 'USER',
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  open_id TEXT NOT NULL UNIQUE
);

INSERT INTO
  user (
    id,
    created_ts,
    updated_ts,
    row_status,
    username,
    role,
    email,
    nickname,
    password_hash,
    open_id
  )
SELECT
  id,
  created_ts,
  updated_ts,
  row_status,
  email,
  role,
  email,
  name,
  password_hash,
  open_id
FROM
  _user_old;

DROP TABLE IF EXISTS _user_old;