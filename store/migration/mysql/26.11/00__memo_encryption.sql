CREATE TABLE encryption_vault (
  user_id INTEGER PRIMARY KEY,
  vault_id VARCHAR(36) NOT NULL UNIQUE,
  revision VARCHAR(36) NOT NULL,
  record TEXT NOT NULL
);
CREATE TABLE memo_encryption (
  memo_id INTEGER PRIMARY KEY,
  vault_id VARCHAR(36) NOT NULL,
  object_id VARCHAR(36) NOT NULL,
  revision VARCHAR(36) NOT NULL,
  UNIQUE (vault_id, object_id)
);
