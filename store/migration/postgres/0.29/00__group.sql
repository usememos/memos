-- Create groups table
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  created_ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())),
  FOREIGN KEY (creator_id) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Add group_id column to memo table
ALTER TABLE memo ADD COLUMN group_id INTEGER DEFAULT NULL REFERENCES groups(id) ON DELETE SET NULL;

-- Create group_members table
CREATE TABLE group_members (
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);
