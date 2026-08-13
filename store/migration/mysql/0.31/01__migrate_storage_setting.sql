-- Expands the legacy singleton storage setting into the named storage model.
-- Legacy fields remain in place so older clients and rollback versions can
-- continue to read the active storage configuration.
UPDATE system_setting
SET value = JSON_SET(
  value,
  '$.storages', JSON_ARRAY(JSON_OBJECT(
    'id', 'database',
    'name', 'Database',
    'type', 'STORAGE_TYPE_DATABASE'
  )),
  '$.defaultStorageId', 'database'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN JSON_VALID(value) THEN
      JSON_TYPE(value) = 'OBJECT'
      AND NOT JSON_CONTAINS_PATH(value, 'one', '$.storages')
      AND JSON_UNQUOTE(JSON_EXTRACT(value, '$.storageType')) IN ('DATABASE', '1')
    ELSE FALSE
  END;

UPDATE system_setting
SET value = JSON_SET(
  value,
  '$.storages', JSON_ARRAY(JSON_OBJECT(
    'id', 'local',
    'name', 'Local',
    'type', 'STORAGE_TYPE_LOCAL'
  )),
  '$.defaultStorageId', 'local'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN JSON_VALID(value) THEN
      JSON_TYPE(value) = 'OBJECT'
      AND NOT JSON_CONTAINS_PATH(value, 'one', '$.storages')
      AND (
        NOT JSON_CONTAINS_PATH(value, 'one', '$.storageType')
        OR JSON_UNQUOTE(JSON_EXTRACT(value, '$.storageType')) IN ('STORAGE_TYPE_UNSPECIFIED', 'LOCAL', '0', '2')
      )
    ELSE FALSE
  END;

UPDATE system_setting
SET value = JSON_SET(
  value,
  '$.storages', JSON_ARRAY(JSON_OBJECT(
    'id', 's3',
    'name', 'S3',
    'type', 'STORAGE_TYPE_S3',
    's3Config', JSON_EXTRACT(value, '$.s3Config')
  )),
  '$.defaultStorageId', 's3'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN JSON_VALID(value) THEN
      JSON_TYPE(value) = 'OBJECT'
      AND NOT JSON_CONTAINS_PATH(value, 'one', '$.storages')
      AND JSON_UNQUOTE(JSON_EXTRACT(value, '$.storageType')) IN ('S3', '3')
      AND JSON_TYPE(JSON_EXTRACT(value, '$.s3Config')) = 'OBJECT'
    ELSE FALSE
  END;

-- Attachments created before S3 configs were embedded only stored the object
-- key. Bind them to the namespace captured above before that default changes.
UPDATE attachment
SET payload = JSON_SET(payload, '$.s3Object.storageId', 's3')
WHERE storage_type = 'S3'
  AND CASE
    WHEN JSON_VALID(payload) THEN
      JSON_TYPE(payload) = 'OBJECT'
      AND JSON_TYPE(JSON_EXTRACT(payload, '$.s3Object')) = 'OBJECT'
      AND NOT JSON_CONTAINS_PATH(payload, 'one', '$.s3Object.storageId')
      AND NOT JSON_CONTAINS_PATH(payload, 'one', '$.s3Object.s3Config')
    ELSE FALSE
  END
  AND EXISTS (
    SELECT 1
    FROM system_setting AS storage_setting
    WHERE storage_setting.name = 'STORAGE'
      AND CASE
        WHEN JSON_VALID(storage_setting.value) THEN
          JSON_UNQUOTE(JSON_EXTRACT(storage_setting.value, '$.defaultStorageId')) = 's3'
        ELSE FALSE
      END
  );
