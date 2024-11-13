ALTER TABLE
    memo
ADD
    COLUMN nest INT NOT NULL DEFAULT 0;

INSERT INTO
    nest (uid, creator_id)
SELECT
    'Personal', id
FROM
    user;