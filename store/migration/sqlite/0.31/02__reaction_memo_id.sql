-- Replaces the memo resource name stored in reaction.content_id with the
-- memo's stable internal ID. The inner join intentionally drops orphaned
-- reactions whose resource name no longer resolves to an existing memo.
CREATE TABLE reaction_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  creator_id INTEGER NOT NULL,
  memo_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL,
  UNIQUE(creator_id, memo_id, reaction_type)
);

INSERT INTO reaction_new (id, created_ts, creator_id, memo_id, reaction_type)
SELECT
  reaction.id,
  reaction.created_ts,
  reaction.creator_id,
  memo.id,
  reaction.reaction_type
FROM reaction
JOIN memo ON reaction.content_id = 'memos/' || memo.uid;

DROP TABLE reaction;
ALTER TABLE reaction_new RENAME TO reaction;
