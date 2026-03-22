DROP TABLE IF EXISTS resource_temp;

CREATE TABLE resource_temp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  filename TEXT NOT NULL DEFAULT '',
  blob BLOB DEFAULT NULL,
  external_link TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  internal_path TEXT NOT NULL DEFAULT ''
);

INSERT INTO
  resource_temp (id, creator_id, created_ts, updated_ts, filename, blob, external_link, type, size, internal_path)
SELECT
  id, creator_id, created_ts, updated_ts, filename, blob, external_link, type, size, internal_path
FROM
  resource;

DROP TABLE resource;

ALTER TABLE resource_temp RENAME TO resource;
