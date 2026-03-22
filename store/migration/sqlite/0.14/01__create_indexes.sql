CREATE INDEX IF NOT EXISTS idx_user_username ON user (username);
CREATE INDEX IF NOT EXISTS idx_memo_creator_id ON memo (creator_id);
CREATE INDEX IF NOT EXISTS idx_memo_content ON memo (content);
CREATE INDEX IF NOT EXISTS idx_memo_visibility ON memo (visibility);
CREATE INDEX IF NOT EXISTS idx_resource_creator_id ON resource (creator_id);
