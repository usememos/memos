-- Renames the SHORTCUTS user setting to MEMO_VIEWS, rewriting the stored JSON
-- object key from `shortcuts` to `memoViews` to match the renamed proto field.
--
-- Invalid or non-object JSON values are skipped rather than aborting the upgrade,
-- while the conflict check preserves an existing MEMO_VIEWS setting.
UPDATE user_setting AS legacy
SET
  key = 'MEMO_VIEWS',
  value = CASE
    WHEN legacy.value::jsonb ? 'shortcuts' THEN jsonb_set(
      legacy.value::jsonb - 'shortcuts',
      '{memoViews}',
      legacy.value::jsonb->'shortcuts'
    )::text
    ELSE legacy.value
  END
WHERE legacy.key = 'SHORTCUTS'
  AND CASE
    WHEN pg_input_is_valid(legacy.value, 'jsonb')
      THEN jsonb_typeof(legacy.value::jsonb) = 'object'
    ELSE FALSE
  END
  AND NOT EXISTS (
    SELECT 1
    FROM user_setting AS existing
    WHERE existing.user_id = legacy.user_id
      AND existing.key = 'MEMO_VIEWS'
  );
