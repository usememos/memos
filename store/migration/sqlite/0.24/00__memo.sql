-- Remove deprecated indexes.
DROP INDEX IF EXISTS idx_memo_tags;
DROP INDEX IF EXISTS idx_memo_content;
DROP INDEX IF EXISTS idx_memo_visibility;

-- Drop deprecated tags column.
ALTER TABLE memo DROP COLUMN tags;