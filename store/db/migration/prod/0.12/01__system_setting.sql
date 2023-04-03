UPDATE
  system_setting
SET
  key = 'server-id'
WHERE
  key = 'serverId';

UPDATE
  system_setting
SET
  key = 'secret-session'
WHERE
  key = 'secretSessionName';

UPDATE
  system_setting
SET
  key = 'allow-signup'
WHERE
  key = 'allowSignUp';

UPDATE
  system_setting
SET
  key = 'disable-public-memos'
WHERE
  key = 'disablePublicMemos';

UPDATE
  system_setting
SET
  key = 'additional-style'
WHERE
  key = 'additionalStyle';

UPDATE
  system_setting
SET
  key = 'additional-script'
WHERE
  key = 'additionalScript';

UPDATE
  system_setting
SET
  key = 'customized-profile'
WHERE
  key = 'customizedProfile';

UPDATE
  system_setting
SET
  key = 'storage-service-id'
WHERE
  key = 'storageServiceId';

UPDATE
  system_setting
SET
  key = 'local-storage-path'
WHERE
  key = 'localStoragePath';

UPDATE
  system_setting
SET
  key = 'openai-config'
WHERE
  key = 'openAIConfig';