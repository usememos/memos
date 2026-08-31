CREATE TABLE space_member_new (
  space_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
  PRIMARY KEY (space_id, user_id)
);

INSERT INTO space_member_new (space_id, user_id, status, role)
SELECT space_id, user_id, 'ACTIVE', role
FROM space_member;

DROP TABLE space_member;
ALTER TABLE space_member_new RENAME TO space_member;

CREATE INDEX idx_space_member_user_id ON space_member(user_id, space_id);
