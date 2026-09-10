ALTER TABLE space ADD COLUMN payload JSON;
UPDATE space SET payload = '{}';
ALTER TABLE space MODIFY COLUMN payload JSON NOT NULL;
