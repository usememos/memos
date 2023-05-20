DROP TABLE IF EXISTS memo_organizer_temp;

CREATE TABLE memo_organizer_temp (
  memo_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  UNIQUE(memo_id, user_id)
);

INSERT INTO
  memo_organizer_temp (memo_id, user_id, pinned)
SELECT
  memo_id,
  user_id,
  pinned
FROM
  memo_organizer;

DROP TABLE memo_organizer;

ALTER TABLE
  memo_organizer_temp RENAME TO memo_organizer;