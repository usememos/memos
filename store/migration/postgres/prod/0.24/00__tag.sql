-- Create tag table for storing memo tag metadata
CREATE TABLE tag (
  id SERIAL PRIMARY KEY,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  creator_id INTEGER NOT NULL,
  tag_hash TEXT NOT NULL,
  tag_name TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '',
  pinned_ts BIGINT,
  UNIQUE(creator_id, tag_hash)
);
