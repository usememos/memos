DROP INDEX IF EXISTS idx_memo_tags;

-- Drop deprecated tags column.
ALTER TABLE memo DROP COLUMN tags;
