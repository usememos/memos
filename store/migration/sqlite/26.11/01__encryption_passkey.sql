CREATE TABLE encryption_passkey (
  user_id INTEGER NOT NULL,
  id VARCHAR(36) NOT NULL,
  credential_id VARCHAR(1366) NOT NULL,
  record TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, credential_id),
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);
