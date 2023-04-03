INSERT INTO
  user_setting (user_id, key, value)
SELECT
  user_id,
  'memo-visibility',
  value
FROM
  user_setting
WHERE
  key = 'memoVisibility';

DELETE FROM
  user_setting
WHERE
  key = 'memoVisibility';