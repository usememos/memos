-- Index the bounded lookup key; attachment.type is unbounded text on PostgreSQL.
CREATE INDEX IF NOT EXISTS idx_attachment_memo_id ON attachment(memo_id);
