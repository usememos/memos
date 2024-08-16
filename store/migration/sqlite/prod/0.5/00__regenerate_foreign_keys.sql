PRAGMA foreign_keys = off;

DROP TABLE IF EXISTS _user_old;

ALTER TABLE
  user RENAME TO _user_old;

-- user
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
  user
SELECT
  *
FROM
  _user_old;

DROP TABLE IF EXISTS _user_old;

DROP TRIGGER IF EXISTS `trigger_update_user_modification_time`;

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

DROP TABLE IF EXISTS _memo_old;

ALTER TABLE
  memo RENAME TO _memo_old;

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
  memo
SELECT
  *
FROM
  _memo_old;

DROP TABLE IF EXISTS _memo_old;

DROP TRIGGER IF EXISTS `trigger_update_memo_modification_time`;

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

DROP TABLE IF EXISTS _memo_organizer_old;

ALTER TABLE
  memo_organizer RENAME TO _memo_organizer_old;

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
  memo_organizer
SELECT
  *
FROM
  _memo_organizer_old;

DROP TABLE IF EXISTS _memo_organizer_old;

DROP TABLE IF EXISTS _shortcut_old;

ALTER TABLE
  shortcut RENAME TO _shortcut_old;

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
  shortcut
SELECT
  *
FROM
  _shortcut_old;

DROP TABLE IF EXISTS _shortcut_old;

DROP TRIGGER IF EXISTS `trigger_update_shortcut_modification_time`;

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

DROP TABLE IF EXISTS _resource_old;

ALTER TABLE
  resource RENAME TO _resource_old;

-- resource
CREATE TABLE resource (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  filename TEXT NOT NULL DEFAULT '',
  blob BLOB DEFAULT NULL,
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(creator_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO
  resource
SELECT
  *
FROM
  _resource_old;

DROP TABLE IF EXISTS _resource_old;

DROP TRIGGER IF EXISTS `trigger_update_resource_modification_time`;

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

DROP TABLE IF EXISTS _user_setting_old;

ALTER TABLE
  user_setting RENAME TO _user_setting_old;

-- user_setting
CREATE TABLE user_setting (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE(user_id, key)
);

INSERT INTO
  user_setting
SELECT
  *
FROM
  _user_setting_old;

DROP TABLE IF EXISTS _user_setting_old;

PRAGMA foreign_keys = on;