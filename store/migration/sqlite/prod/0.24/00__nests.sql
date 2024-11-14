ALTER TABLE
  memo
ADD
  COLUMN nest INTEGER NOT NULL DEFAULT 0;

CREATE TABLE nest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL'
);

INSERT INTO
  nest (name, creator_id)
SELECT
  'Personal', id
FROM
  user;

UPDATE
  memo
SET
  nest = (
    SELECT id
    FROM nest
    WHERE creator_id = memo.creator_id
  )
WHERE
  nest = 0;