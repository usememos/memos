-- Expands the legacy singleton storage setting into the named storage model.
-- Legacy fields remain in place so older clients and rollback versions can
-- continue to read the active storage configuration.
UPDATE system_setting
SET value = jsonb_set(
  jsonb_set(
    value::jsonb,
    '{storages}',
    jsonb_build_array(jsonb_build_object(
      'id', 'database',
      'name', 'Database',
      'type', 'STORAGE_TYPE_DATABASE'
    ))
  ),
  '{defaultStorageId}',
  to_jsonb('database'::text)
)::text
WHERE name = 'STORAGE'
  AND CASE
    WHEN pg_input_is_valid(value, 'jsonb') THEN
      jsonb_typeof(value::jsonb) = 'object'
      AND NOT value::jsonb ? 'storages'
      AND value::jsonb->>'storageType' IN ('DATABASE', '1')
    ELSE FALSE
  END;

UPDATE system_setting
SET value = jsonb_set(
  jsonb_set(
    value::jsonb,
    '{storages}',
    jsonb_build_array(jsonb_build_object(
      'id', 'local',
      'name', 'Local',
      'type', 'STORAGE_TYPE_LOCAL'
    ))
  ),
  '{defaultStorageId}',
  to_jsonb('local'::text)
)::text
WHERE name = 'STORAGE'
  AND CASE
    WHEN pg_input_is_valid(value, 'jsonb') THEN
      jsonb_typeof(value::jsonb) = 'object'
      AND NOT value::jsonb ? 'storages'
      AND (
        NOT value::jsonb ? 'storageType'
        OR value::jsonb->>'storageType' IN ('STORAGE_TYPE_UNSPECIFIED', 'LOCAL', '0', '2')
      )
    ELSE FALSE
  END;

UPDATE system_setting
SET value = jsonb_set(
  jsonb_set(
    value::jsonb,
    '{storages}',
    jsonb_build_array(jsonb_build_object(
      'id', 's3',
      'name', 'S3',
      'type', 'STORAGE_TYPE_S3',
      's3Config', value::jsonb->'s3Config'
    ))
  ),
  '{defaultStorageId}',
  to_jsonb('s3'::text)
)::text
WHERE name = 'STORAGE'
  AND CASE
    WHEN pg_input_is_valid(value, 'jsonb') THEN
      jsonb_typeof(value::jsonb) = 'object'
      AND NOT value::jsonb ? 'storages'
      AND value::jsonb->>'storageType' IN ('S3', '3')
      AND jsonb_typeof(value::jsonb->'s3Config') = 'object'
    ELSE FALSE
  END;

-- Attachments created before S3 configs were embedded only stored the object
-- key. Bind them to the namespace captured above before that default changes.
UPDATE attachment
SET payload = jsonb_set(
  payload::jsonb,
  '{s3Object,storageId}',
  to_jsonb('s3'::text)
)::text
WHERE storage_type = 'S3'
  AND CASE
    WHEN pg_input_is_valid(payload, 'jsonb') THEN
      jsonb_typeof(payload::jsonb) = 'object'
      AND jsonb_typeof(payload::jsonb->'s3Object') = 'object'
      AND NOT payload::jsonb->'s3Object' ? 'storageId'
      AND NOT payload::jsonb->'s3Object' ? 's3Config'
    ELSE FALSE
  END
  AND EXISTS (
    SELECT 1
    FROM system_setting AS storage_setting
    WHERE storage_setting.name = 'STORAGE'
      AND CASE
        WHEN pg_input_is_valid(storage_setting.value, 'jsonb') THEN
          storage_setting.value::jsonb->>'defaultStorageId' = 's3'
        ELSE FALSE
      END
  );
