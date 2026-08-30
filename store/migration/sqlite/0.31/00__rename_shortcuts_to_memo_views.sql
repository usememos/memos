-- Renames the SHORTCUTS user setting to MEMO_VIEWS, rewriting the stored JSON
-- object key from `shortcuts` to `memoViews` to match the renamed proto field.
--
-- Rows are skipped rather than failing the migration when either
--   * `value` is not valid JSON, which would abort the whole upgrade transaction, or
--   * the user already has a MEMO_VIEWS row, which would violate UNIQUE(user_id, key).
UPDATE user_setting
SET
  key = 'MEMO_VIEWS',
  value = CASE
    WHEN json_type(value, '$.shortcuts') IS NOT NULL THEN json_set(
      json_remove(value, '$.shortcuts'),
      '$.memoViews',
      json_extract(value, '$.shortcuts')
    )
    ELSE value
  END
WHERE key = 'SHORTCUTS'
  AND CASE
    WHEN json_valid(value) THEN json_type(value) = 'object'
    ELSE 0
  END
  AND user_id NOT IN (
    SELECT user_id FROM user_setting WHERE key = 'MEMO_VIEWS'
  );
