-- memo already has idx_memo_creator_id on SQLite.
CREATE INDEX IF NOT EXISTS idx_attachment_creator_id ON attachment(creator_id);
