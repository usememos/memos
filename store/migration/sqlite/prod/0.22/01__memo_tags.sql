ALTER TABLE memo ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

CREATE INDEX idx_memo_tags ON memo (tags);
