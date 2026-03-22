-- tag
CREATE TABLE tag (
  name TEXT NOT NULL,
  creator_id INTEGER NOT NULL,
  UNIQUE(name, creator_id)
);