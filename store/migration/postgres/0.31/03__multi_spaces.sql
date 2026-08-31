CREATE TABLE space (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE space_member (
  space_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
  PRIMARY KEY (space_id, user_id)
);

ALTER TABLE memo ADD COLUMN space_id INTEGER DEFAULT NULL;

CREATE INDEX idx_space_member_user_id ON space_member(user_id, space_id);
CREATE INDEX idx_memo_space_id ON memo(space_id, row_status, created_ts DESC, id DESC);
CREATE INDEX idx_memo_relation_related_type_memo
  ON memo_relation(related_memo_id, type, memo_id);
