-- Index the bounded lookup key; attachment.type is unbounded text on PostgreSQL.
DO $$
BEGIN
    IF to_regclass('idx_attachment_memo_id') IS NULL THEN
        CREATE INDEX idx_attachment_memo_id ON attachment(memo_id);
    ELSIF NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_am am ON am.oid = c.relam
        WHERE i.indexrelid = to_regclass('idx_attachment_memo_id')
          AND i.indrelid = 'attachment'::regclass
          AND i.indisvalid AND i.indisready AND NOT i.indisunique
          AND i.indpred IS NULL AND i.indexprs IS NULL
          AND i.indnatts = 1 AND i.indnkeyatts = 1
          AND pg_get_indexdef(i.indexrelid, 1, true) = 'memo_id'
          AND am.amname = 'btree'
    ) THEN
        RAISE EXCEPTION 'conflicting definition for idx_attachment_memo_id';
    END IF;
END $$;
