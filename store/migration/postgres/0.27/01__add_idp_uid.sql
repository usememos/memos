-- Add uid column to idp table
ALTER TABLE idp ADD COLUMN uid TEXT NOT NULL DEFAULT '';

-- Populate uid for existing rows using hex of id as a fallback
UPDATE idp SET uid = LPAD(TO_HEX(id), 8, '0') WHERE uid = '';

-- Create unique index on uid
CREATE UNIQUE INDEX IF NOT EXISTS idx_idp_uid ON idp (uid);
