ALTER TABLE memo ADD COLUMN resource_name TEXT NOT NULL DEFAULT "";

UPDATE memo SET resource_name = lower(hex(randomblob(8)));

CREATE UNIQUE INDEX idx_memo_resource_name ON memo (resource_name);

ALTER TABLE resource ADD COLUMN resource_name TEXT NOT NULL DEFAULT "";

UPDATE resource SET resource_name = lower(hex(randomblob(8)));

CREATE UNIQUE INDEX idx_resource_resource_name ON resource (resource_name);
