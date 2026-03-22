-- Add uid column to idp table
ALTER TABLE idp ADD COLUMN uid TEXT NOT NULL DEFAULT '';

-- Populate uid for existing rows using hex of id as a fallback
UPDATE idp SET uid = printf('%08x', id) WHERE uid = '';

-- Create unique index on uid
CREATE UNIQUE INDEX IF NOT EXISTS idx_idp_uid ON idp (uid);
