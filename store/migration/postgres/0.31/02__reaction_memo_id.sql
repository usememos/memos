-- Replaces the memo resource name stored in reaction.content_id with the
-- memo's stable internal ID. Rows that cannot be resolved are intentionally
-- deleted before memo_id is made non-nullable.
ALTER TABLE reaction ADD COLUMN memo_id INTEGER;

UPDATE reaction
SET memo_id = memo.id
FROM memo
WHERE reaction.content_id = 'memos/' || memo.uid;

DELETE FROM reaction WHERE memo_id IS NULL;

ALTER TABLE reaction
  DROP CONSTRAINT reaction_creator_id_content_id_reaction_type_key,
  DROP COLUMN content_id,
  ALTER COLUMN memo_id SET NOT NULL,
  ADD UNIQUE (creator_id, memo_id, reaction_type);
