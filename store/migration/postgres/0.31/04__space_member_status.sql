ALTER TABLE space_member
  ADD COLUMN status TEXT;

UPDATE space_member
SET status = 'ACTIVE';

ALTER TABLE space_member
  ALTER COLUMN status SET NOT NULL;
