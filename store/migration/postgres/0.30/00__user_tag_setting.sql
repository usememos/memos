INSERT INTO user_setting (user_id, key, value)
SELECT
  "user".id,
  'TAGS',
  system_setting.value
FROM "user"
JOIN system_setting ON system_setting.name = 'TAGS'
WHERE system_setting.value IS NOT NULL
  AND system_setting.value != ''
  AND system_setting.value != '{}'
ON CONFLICT (user_id, key) DO NOTHING;
