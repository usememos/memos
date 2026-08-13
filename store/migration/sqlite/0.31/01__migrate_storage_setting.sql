-- Expands the legacy singleton storage setting into the named storage model.
-- Legacy fields remain in place so older clients and rollback versions can
-- continue to read the active storage configuration.
UPDATE system_setting
SET value = json_set(
  value,
  '$.storages', json_array(json_object(
    'id', 'database',
    'name', 'Database',
    'type', 'STORAGE_TYPE_DATABASE'
  )),
  '$.defaultStorageId', 'database'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN json_valid(value) THEN
      json_type(value) = 'object'
      AND json_type(value, '$.storages') IS NULL
      AND json_extract(value, '$.storageType') IN ('DATABASE', 1)
    ELSE FALSE
  END;

UPDATE system_setting
SET value = json_set(
  value,
  '$.storages', json_array(json_object(
    'id', 'local',
    'name', 'Local',
    'type', 'STORAGE_TYPE_LOCAL'
  )),
  '$.defaultStorageId', 'local'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN json_valid(value) THEN
      json_type(value) = 'object'
      AND json_type(value, '$.storages') IS NULL
      AND (
        json_type(value, '$.storageType') IS NULL
        OR json_extract(value, '$.storageType') IN ('STORAGE_TYPE_UNSPECIFIED', 'LOCAL', 0, 2)
      )
    ELSE FALSE
  END;

UPDATE system_setting
SET value = json_set(
  value,
  '$.storages', json_array(json_object(
    'id', 's3',
    'name', 'S3',
    'type', 'STORAGE_TYPE_S3',
    's3Config', json_extract(value, '$.s3Config')
  )),
  '$.defaultStorageId', 's3'
)
WHERE name = 'STORAGE'
  AND CASE
    WHEN json_valid(value) THEN
      json_type(value) = 'object'
      AND json_type(value, '$.storages') IS NULL
      AND json_extract(value, '$.storageType') IN ('S3', 3)
      AND json_type(value, '$.s3Config') = 'object'
    ELSE FALSE
  END;

-- Attachments created before S3 configs were embedded only stored the object
-- key. Bind them to the namespace captured above before that default changes.
UPDATE attachment
SET payload = json_set(payload, '$.s3Object.storageId', 's3')
WHERE storage_type = 'S3'
  AND CASE
    WHEN json_valid(payload) THEN
      json_type(payload) = 'object'
      AND json_type(payload, '$.s3Object') = 'object'
      AND json_type(payload, '$.s3Object.storageId') IS NULL
      AND json_type(payload, '$.s3Object.s3Config') IS NULL
    ELSE FALSE
  END
  AND EXISTS (
    SELECT 1
    FROM system_setting AS storage_setting
    WHERE storage_setting.name = 'STORAGE'
      AND CASE
        WHEN json_valid(storage_setting.value) THEN
          json_extract(storage_setting.value, '$.defaultStorageId') = 's3'
        ELSE FALSE
      END
  );
