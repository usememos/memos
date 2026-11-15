CREATE INDEX IF NOT EXISTS idx_attachment_memo_id_type ON attachment(memo_id, type);

-- IF NOT EXISTS alone would silently accept an operator-created conflicting index.
CREATE TEMP TABLE attachment_index_check (
    valid INTEGER CONSTRAINT idx_attachment_memo_id_type_definition CHECK (valid = 1)
);
INSERT INTO attachment_index_check
SELECT EXISTS (
    SELECT 1 FROM pragma_index_list('attachment')
    WHERE name = 'idx_attachment_memo_id_type' AND "unique" = 0 AND partial = 0
) AND (
    SELECT COUNT(*) = 2
        AND SUM(seqno = 0 AND name = 'memo_id') = 1
        AND SUM(seqno = 1 AND name = 'type') = 1
    FROM pragma_index_info('idx_attachment_memo_id_type')
);
DROP TABLE attachment_index_check;
