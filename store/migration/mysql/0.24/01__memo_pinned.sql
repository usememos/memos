-- Add pinned column.
ALTER TABLE `memo` ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT FALSE;

-- Update pinned column from memo_organizer.
UPDATE memo
JOIN memo_organizer ON memo.id = memo_organizer.memo_id
SET memo.pinned = TRUE
WHERE memo_organizer.pinned = 1;
