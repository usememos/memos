-- user
CREATE TABLE user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  open_id TEXT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(`name`, `open_id`)
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('user', 0);

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
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  -- allowed row status are 'NORMAL', 'HIDDEN'.
  row_status TEXT NOT NULL DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  creator_id INTEGER NOT NULL,
  FOREIGN KEY(creator_id) REFERENCES users(id)
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('memo', 100);

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

-- shortcut
CREATE TABLE shortcut (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),

  title TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '',
  creator_id INTEGER NOT NULL,
  pinned_ts BIGINT NOT NULL DEFAULT 0,
  FOREIGN KEY(creator_id) REFERENCES users(id)
);

INSERT INTO
  sqlite_sequence (name, seq)
VALUES
  ('shortcut', 0);

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
  filename TEXT NOT NULL DEFAULT '',
  blob BLOB NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  creator_id INTEGER NOT NULL,
  FOREIGN KEY(creator_id) REFERENCES users(id)
);

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


INSERT INTO user
  (`id`, `name`, `password`, `open_id`)
VALUES
  (1, 'guest', '123456', 'guest_open_id'),
  (2, 'mine', '123456', 'mine_open_id');

INSERT INTO memo
  (`content`, `creator_id`)
VALUES
  ('👋 Welcome to memos', 1),
  ('👋 Welcome to memos', 2);
