-- ai_conversation: stores chat conversations
CREATE TABLE ai_conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  title VARCHAR(512) NOT NULL DEFAULT 'New Chat',
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  updated_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  row_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  model VARCHAR(128) NOT NULL DEFAULT '',
  provider VARCHAR(64) NOT NULL DEFAULT '',
  INDEX idx_ai_conversation_user_id (user_id),
  INDEX idx_ai_conversation_created_ts (created_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_message: stores individual messages in conversations
CREATE TABLE ai_message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  conversation_id INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  token_count INT NOT NULL DEFAULT 0,
  INDEX idx_ai_message_conversation_id (conversation_id),
  INDEX idx_ai_message_created_ts (created_ts),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
