ALTER TABLE resource ADD COLUMN memo_id INTEGER;

UPDATE resource
SET memo_id = (
  SELECT memo_id
  FROM memo_resource
  WHERE resource.id = memo_resource.resource_id
  LIMIT 1
);

CREATE INDEX idx_resource_memo_id ON resource (memo_id);

DROP TABLE IF EXISTS memo_resource;
