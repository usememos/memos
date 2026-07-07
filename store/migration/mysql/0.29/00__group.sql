-- Create groups table
CREATE TABLE `groups` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(256) NOT NULL,
  description TEXT NOT NULL,
  creator_id INT NOT NULL,
  visibility VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
  created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Add group_id column to memo table
ALTER TABLE memo ADD COLUMN group_id INT DEFAULT NULL;
ALTER TABLE memo ADD CONSTRAINT fk_memo_group_id FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL;

-- Create group_members table
CREATE TABLE group_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
