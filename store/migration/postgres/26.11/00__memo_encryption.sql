CREATE TABLE encryption_vault (
  user_id INTEGER PRIMARY KEY,
  vault_id VARCHAR(36) NOT NULL UNIQUE,
  revision VARCHAR(36) NOT NULL,
  record TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE TABLE memo_encryption (
  memo_id INTEGER PRIMARY KEY,
  vault_id VARCHAR(36) NOT NULL,
  object_id VARCHAR(36) NOT NULL,
  revision VARCHAR(36) NOT NULL,
  UNIQUE (vault_id, object_id),
  FOREIGN KEY (memo_id) REFERENCES memo (id) ON DELETE CASCADE
);
