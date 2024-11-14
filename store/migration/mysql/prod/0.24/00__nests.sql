ALTER TABLE
    memo
ADD
    COLUMN nest INT NOT NULL DEFAULT 0;

CREATE TABLE nest (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(256) NOT NULL,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `row_status` VARCHAR(256) NOT NULL DEFAULT 'NORMAL'
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
        LIMIT 1
    )
WHERE
    nest = 0;
