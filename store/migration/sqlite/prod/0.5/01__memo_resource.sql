-- memo_resource
CREATE TABLE memo_resource (
  memo_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(memo_id) REFERENCES memo(id) ON DELETE CASCADE,
  FOREIGN KEY(resource_id) REFERENCES resource(id) ON DELETE CASCADE,
  UNIQUE(memo_id, resource_id)
);