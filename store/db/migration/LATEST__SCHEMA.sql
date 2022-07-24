-- drop all tables
DROP TABLE IF EXISTS `memo_organizer`;
DROP TABLE IF EXISTS `memo`;
DROP TABLE IF EXISTS `shortcut`;
DROP TABLE IF EXISTS `resource`;
DROP TABLE IF EXISTS `user`;

-- user
CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  -- allowed row status are 'NORMAL', 'ARCHIVED'.
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('HOST', 'USER')) DEFAULT 'USER',
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  open_id TEXT NOT NULL UNIQUE
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('user', 100);

CREATE TRIGGER IF NOT EXISTS `trigger_update_user_modification_time`
AFTER
UPDATE
  ON `user` FOR EACH ROW BEGIN
UPDATE
  `user`
SET
  updated_ts = (strftime('%s', 'now'))
WHERE
  rowid = old.rowid;
END;

-- memo
CREATE TABLE memo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED', 'PRIVATE')) DEFAULT 'PRIVATE',
  FOREIGN KEY(creator_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('memo', 1000);

CREATE TRIGGER IF NOT EXISTS `trigger_update_memo_modification_time`
AFTER
UPDATE
  ON `memo` FOR EACH ROW BEGIN
UPDATE
  `memo`
SET
  updated_ts = (strftime('%s', 'now'))
WHERE
  rowid = old.rowid;
END;

-- memo_organizer
CREATE TABLE memo_organizer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  FOREIGN KEY(memo_id) REFERENCES memo(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE(memo_id, user_id)
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('memo_organizer', 1000);

-- shortcut
CREATE TABLE shortcut (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  title TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(creator_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('shortcut', 10000);

CREATE TRIGGER IF NOT EXISTS `trigger_update_shortcut_modification_time`
AFTER
UPDATE
  ON `shortcut` FOR EACH ROW BEGIN
UPDATE
  `shortcut`
SET
  updated_ts = (strftime('%s', 'now'))
WHERE
  rowid = old.rowid;
END;

-- resource
CREATE TABLE resource (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  filename TEXT NOT NULL DEFAULT '',
  blob BLOB NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(creator_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('resource', 10000);

CREATE TRIGGER IF NOT EXISTS `trigger_update_resource_modification_time`
AFTER
UPDATE
  ON `resource` FOR EACH ROW BEGIN
UPDATE
  `resource`
SET
  updated_ts = (strftime('%s', 'now'))
WHERE
  rowid = old.rowid;
END;
