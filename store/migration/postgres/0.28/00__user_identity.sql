-- user_identity stores the linkage between an external identity subject and a local user.
-- (provider, extern_uid) is unique across the table; provider stores the idp.uid.
CREATE TABLE user_identity (
  id         SERIAL  PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  provider   TEXT    NOT NULL,
  extern_uid TEXT    NOT NULL,
  created_ts BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT  NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  UNIQUE (provider, extern_uid)
);

CREATE INDEX idx_user_identity_user_id ON user_identity(user_id);
