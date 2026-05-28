-- Set storage type to DATABASE for existing instances that have no storage setting configured.
-- This preserves backward-compatible behavior before the default was changed to LOCAL.
INSERT INTO system_setting (name, value, description)
SELECT 'STORAGE', '{"storageType":"DATABASE"}', ''
WHERE NOT EXISTS (SELECT 1 FROM system_setting WHERE name = 'STORAGE');
