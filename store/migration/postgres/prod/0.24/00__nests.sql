ALTER TABLE
  memo
ADD
  COLUMN nest INTEGER NOT NULL DEFAULT 0;

CREATE TABLE nest (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  row_status TEXT NOT NULL DEFAULT 'NORMAL'
);

INSERT INTO
  nest (name, creator_id)
SELECT
  'Personal', id
FROM
  "user";

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