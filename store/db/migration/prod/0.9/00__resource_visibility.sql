-- Add visibility field to resource
ALTER TABLE resource ADD COLUMN visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'PROTECTED' 'PRIVATE')) DEFAULT 'PRIVATE';
