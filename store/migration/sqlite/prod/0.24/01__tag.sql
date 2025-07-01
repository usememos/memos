-- Create tag table for storing memo tag metadata
CREATE TABLE tag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  creator_id INTEGER NOT NULL,
  tag_hash TEXT NOT NULL,
  tag_name TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '',
  pinned_ts BIGINT,
  UNIQUE(creator_id, tag_hash)
);

-- Create indexes for better query performance
CREATE INDEX idx_tag_creator_id ON tag(creator_id);
CREATE INDEX idx_tag_pinned_ts ON tag(pinned_ts); 
