-- ai_conversation: stores chat conversations
CREATE TABLE ai_conversation (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  title VARCHAR(512) NOT NULL DEFAULT 'New Chat',
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  row_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  model VARCHAR(128) NOT NULL DEFAULT '',
  provider VARCHAR(64) NOT NULL DEFAULT ''
);

CREATE INDEX idx_ai_conversation_user_id ON ai_conversation(user_id);
CREATE INDEX idx_ai_conversation_created_ts ON ai_conversation(created_ts);

-- ai_message: stores individual messages in conversations
CREATE TABLE ai_message (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(256) NOT NULL UNIQUE,
  conversation_id INT NOT NULL REFERENCES ai_conversation(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  token_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_ai_message_conversation_id ON ai_message(conversation_id);
CREATE INDEX idx_ai_message_created_ts ON ai_message(created_ts);
