-- Renames the SHORTCUTS user setting to MEMO_VIEWS, rewriting the stored JSON
-- object key from `shortcuts` to `memoViews` to match the renamed proto field.
--
-- Rows are skipped rather than failing the migration when either
--   * `value` is not valid JSON, which would abort the whole upgrade transaction, or
--   * the user already has a MEMO_VIEWS row, which would violate UNIQUE(user_id, key).
-- The conflict check goes through a derived table because MySQL cannot read the
-- target table of an UPDATE directly in a subquery.
UPDATE user_setting
SET
  `key` = 'MEMO_VIEWS',
  value = CASE
    WHEN JSON_CONTAINS_PATH(value, 'one', '$.shortcuts') THEN JSON_SET(
      JSON_REMOVE(value, '$.shortcuts'),
      '$.memoViews',
      JSON_EXTRACT(value, '$.shortcuts')
    )
    ELSE value
  END
WHERE `key` = 'SHORTCUTS'
  AND CASE
    WHEN JSON_VALID(value) THEN JSON_TYPE(value) = 'OBJECT'
    ELSE FALSE
  END
  AND user_id NOT IN (
    SELECT user_id FROM (
      SELECT user_id FROM user_setting WHERE `key` = 'MEMO_VIEWS'
    ) AS existing_memo_views
  );
