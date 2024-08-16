UPDATE
  system_setting
SET
  name = 'server-id'
WHERE
  name = 'serverId';

UPDATE
  system_setting
SET
  name = 'secret-session'
WHERE
  name = 'secretSessionName';

UPDATE
  system_setting
SET
  name = 'allow-signup'
WHERE
  name = 'allowSignUp';

UPDATE
  system_setting
SET
  name = 'disable-public-memos'
WHERE
  name = 'disablePublicMemos';

UPDATE
  system_setting
SET
  name = 'additional-style'
WHERE
  name = 'additionalStyle';

UPDATE
  system_setting
SET
  name = 'additional-script'
WHERE
  name = 'additionalScript';

UPDATE
  system_setting
SET
  name = 'customized-profile'
WHERE
  name = 'customizedProfile';

UPDATE
  system_setting
SET
  name = 'storage-service-id'
WHERE
  name = 'storageServiceId';

UPDATE
  system_setting
SET
  name = 'local-storage-path'
WHERE
  name = 'localStoragePath';

UPDATE
  system_setting
SET
  name = 'openai-config'
WHERE
  name = 'openAIConfig';