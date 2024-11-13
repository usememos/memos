ALTER TABLE
  memo
ADD
  COLUMN nest INTEGER NOT NULL DEFAULT 0;

INSERT INTO
  nest (name, creator_id)
SELECT
  'Personal', id
FROM
  user;