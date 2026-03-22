-- change user role field from "OWNER"/"USER" to "HOST"/"USER".
PRAGMA foreign_keys = off;

DROP TABLE IF EXISTS _user_old;

ALTER TABLE
  user RENAME TO _user_old;

CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('HOST', 'USER')) DEFAULT 'USER',
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  open_id TEXT NOT NULL UNIQUE
);

INSERT INTO
  user (
    id,
    created_ts,
    updated_ts,
    row_status,
    email,
    name,
    password_hash,
    open_id
  )
SELECT
  id,
  created_ts,
  updated_ts,
  row_status,
  email,
  name,
  password_hash,
  open_id
FROM
  _user_old;

UPDATE
  user
SET
  role = 'HOST'
WHERE
  id IN (
    SELECT
      id
    FROM
      _user_old
    WHERE
      role = 'OWNER'
  );

DROP TABLE IF EXISTS _user_old;

PRAGMA foreign_keys = on;