-- subscription: stores follow relationships between users
CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscription_follower_id ON subscription(follower_id);
CREATE INDEX IF NOT EXISTS idx_subscription_following_id ON subscription(following_id);
