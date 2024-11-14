ALTER TABLE
  memo
ADD
  COLUMN nest INTEGER NOT NULL DEFAULT 0;

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