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