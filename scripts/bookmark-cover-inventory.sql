-- SQLite inventory only: run against a read-only consistent backup.
-- No candidate is deletion-authorized by this report.
-- ponytail: reference classification scans memo text per candidate; use an
-- offline backup for large libraries, add indexed provenance before online GC.
WITH candidates AS (
  SELECT a.id, a.storage_type, a.size, a.created_ts,
    CASE WHEN a.memo_id IS NOT NULL OR EXISTS (
      SELECT 1 FROM memo m
      WHERE instr(m.payload, a.uid) > 0 OR instr(m.content, a.uid) > 0
    ) THEN 'reference-present' ELSE 'reference-not-found' END AS reference_status
  FROM attachment a
  WHERE a.filename GLOB 'link-cover-*'
)
SELECT storage_type, reference_status, COUNT(*) AS attachment_count,
  SUM(size) AS catalog_bytes, MIN(created_ts) AS oldest_created_ts
FROM candidates
GROUP BY storage_type, reference_status
ORDER BY storage_type, reference_status;
