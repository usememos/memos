-- Drop deprecated tags column.
ALTER TABLE memo DROP COLUMN tags;

DROP INDEX IF EXISTS idx_memo_tags;
