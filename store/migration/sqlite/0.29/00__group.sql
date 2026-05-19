-- Add group_id column to memo table
ALTER TABLE memo ADD COLUMN group_id INTEGER DEFAULT NULL;

-- Create groups table
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create group_members table
CREATE TABLE group_members (
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (group_id, user_id)
);
