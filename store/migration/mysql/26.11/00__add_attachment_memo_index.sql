-- MySQL commits DDL before the schema marker. Accept a completed index on retry,
-- but let CREATE fail for a conflicting definition instead of advancing the marker.
SET @memos_attachment_index_sql = IF(
    (SELECT COUNT(*) = 2
        AND SUM(SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'memo_id') = 1
        AND SUM(SEQ_IN_INDEX = 2 AND COLUMN_NAME = 'type') = 1
        AND SUM(SUB_PART IS NOT NULL OR NON_UNIQUE <> 1 OR INDEX_TYPE <> 'BTREE' OR IS_VISIBLE <> 'YES') = 0
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attachment'
       AND INDEX_NAME = 'idx_attachment_memo_id_type'),
    'SELECT 1',
    'CREATE INDEX `idx_attachment_memo_id_type` ON `attachment`(`memo_id`, `type`)'
);
PREPARE memos_attachment_index FROM @memos_attachment_index_sql;
EXECUTE memos_attachment_index;
DEALLOCATE PREPARE memos_attachment_index;
