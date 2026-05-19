-- Add group_id column to memo table
ALTER TABLE memo ADD COLUMN group_id INT DEFAULT NULL;

-- Create groups table
CREATE TABLE groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id INT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create group_members table
CREATE TABLE group_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (group_id, user_id)
);
