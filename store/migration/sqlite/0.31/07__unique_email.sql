-- Make user.email an optional, canonical, instance-unique attribute.
-- Data repair runs against the old table first, then the table is rebuilt
-- because SQLite cannot change a column's nullability in place.

-- Canonical form: trimmed and lowercased. SQLite's LOWER folds ASCII only.
UPDATE user SET email = LOWER(TRIM(email));

-- Values without an '@' are not addresses.
UPDATE user SET email = '' WHERE email NOT LIKE '%@%';

-- For each address held by more than one account, the oldest account keeps it.
UPDATE user
SET email = ''
WHERE email <> ''
  AND id NOT IN (SELECT MIN(id) FROM user WHERE email <> '' GROUP BY email);

CREATE TABLE user_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  username TEXT COLLATE BINARY NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'USER',
  email TEXT COLLATE BINARY DEFAULT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

INSERT INTO user_new (
  id, created_ts, updated_ts, row_status, username, role, email,
  nickname, password_hash, avatar_url, description
)
SELECT
  id, created_ts, updated_ts, row_status, username, role, NULLIF(email, ''),
  nickname, password_hash, avatar_url, description
FROM user;

-- Preserve the largest ID ever issued, including IDs belonging to deleted
-- users that were not copied into the rebuilt table.
INSERT INTO sqlite_sequence (name, seq)
SELECT 'user_new', seq
FROM sqlite_sequence
WHERE name = 'user'
  AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'user_new');

UPDATE sqlite_sequence
SET seq = MAX(seq, (SELECT seq FROM sqlite_sequence WHERE name = 'user'))
WHERE name = 'user_new';

DROP TABLE user;
ALTER TABLE user_new RENAME TO user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user(email);
