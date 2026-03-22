-- Add pinned column.
ALTER TABLE memo ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Update pinned column from memo_organizer.
UPDATE memo
SET pinned = TRUE
FROM memo_organizer
WHERE memo.id = memo_organizer.memo_id AND memo_organizer.pinned = 1;