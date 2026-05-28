-- memo_share stores per-memo share grants (one row per share link).
-- uid is the opaque bearer token included in the share URL.
-- ON DELETE CASCADE ensures grants are cleaned up when the parent memo is deleted.
CREATE TABLE memo_share (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid        VARCHAR(255) NOT NULL UNIQUE,
  memo_id    INT          NOT NULL,
  creator_id INT          NOT NULL,
  created_ts BIGINT       NOT NULL DEFAULT (UNIX_TIMESTAMP()),
  expires_ts BIGINT       DEFAULT NULL,
  FOREIGN KEY (memo_id) REFERENCES memo(id) ON DELETE CASCADE
);

CREATE INDEX idx_memo_share_memo_id ON memo_share(memo_id);
