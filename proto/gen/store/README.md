# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [store/activity.proto](#store_activity-proto)
    - [ActivityMemoCommentPayload](#memos-store-ActivityMemoCommentPayload)
    - [ActivityPayload](#memos-store-ActivityPayload)
    - [ActivityVersionUpdatePayload](#memos-store-ActivityVersionUpdatePayload)
  
- [store/common.proto](#store_common-proto)
    - [RowStatus](#memos-store-RowStatus)
  
- [store/idp.proto](#store_idp-proto)
    - [IdentityProviderConfig](#memos-store-IdentityProviderConfig)
    - [IdentityProviderConfig.FieldMapping](#memos-store-IdentityProviderConfig-FieldMapping)
    - [IdentityProviderConfig.OAuth2](#memos-store-IdentityProviderConfig-OAuth2)
  
- [store/inbox.proto](#store_inbox-proto)
    - [InboxMessage](#memos-store-InboxMessage)
  
    - [InboxMessage.Type](#memos-store-InboxMessage-Type)
  
- [store/reaction.proto](#store_reaction-proto)
    - [Reaction](#memos-store-Reaction)
  
    - [Reaction.Type](#memos-store-Reaction-Type)
  
- [store/storage.proto](#store_storage-proto)
    - [S3Config](#memos-store-S3Config)
    - [Storage](#memos-store-Storage)
    - [StorageConfig](#memos-store-StorageConfig)
  
    - [Storage.Type](#memos-store-Storage-Type)
  
- [store/user_setting.proto](#store_user_setting-proto)
    - [AccessTokensUserSetting](#memos-store-AccessTokensUserSetting)
    - [AccessTokensUserSetting.AccessToken](#memos-store-AccessTokensUserSetting-AccessToken)
    - [UserSetting](#memos-store-UserSetting)
  
    - [UserSettingKey](#memos-store-UserSettingKey)
  
- [store/webhook.proto](#store_webhook-proto)
    - [Webhook](#memos-store-Webhook)
  
- [store/workspace_setting.proto](#store_workspace_setting-proto)
    - [WorkspaceBasicSetting](#memos-store-WorkspaceBasicSetting)
    - [WorkspaceCustomProfile](#memos-store-WorkspaceCustomProfile)
    - [WorkspaceGeneralSetting](#memos-store-WorkspaceGeneralSetting)
    - [WorkspaceMemoRelatedSetting](#memos-store-WorkspaceMemoRelatedSetting)
    - [WorkspaceSetting](#memos-store-WorkspaceSetting)
    - [WorkspaceStorageSetting](#memos-store-WorkspaceStorageSetting)
    - [WorkspaceTelegramIntegrationSetting](#memos-store-WorkspaceTelegramIntegrationSetting)
  
    - [WorkspaceSettingKey](#memos-store-WorkspaceSettingKey)
    - [WorkspaceStorageSetting.StorageType](#memos-store-WorkspaceStorageSetting-StorageType)
  
- [Scalar Value Types](#scalar-value-types)



<a name="store_activity-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/activity.proto



<a name="memos-store-ActivityMemoCommentPayload"></a>

### ActivityMemoCommentPayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo_id | [int32](#int32) |  |  |
| related_memo_id | [int32](#int32) |  |  |






<a name="memos-store-ActivityPayload"></a>

### ActivityPayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo_comment | [ActivityMemoCommentPayload](#memos-store-ActivityMemoCommentPayload) |  |  |
| version_update | [ActivityVersionUpdatePayload](#memos-store-ActivityVersionUpdatePayload) |  |  |






<a name="memos-store-ActivityVersionUpdatePayload"></a>

### ActivityVersionUpdatePayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| version | [string](#string) |  |  |





 

 

 

 



<a name="store_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/common.proto


 


<a name="memos-store-RowStatus"></a>

### RowStatus


| Name | Number | Description |
| ---- | ------ | ----------- |
| ROW_STATUS_UNSPECIFIED | 0 |  |
| NORMAL | 1 |  |
| ARCHIVED | 2 |  |


 

 

 



<a name="store_idp-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/idp.proto



<a name="memos-store-IdentityProviderConfig"></a>

### IdentityProviderConfig



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| oauth2 | [IdentityProviderConfig.OAuth2](#memos-store-IdentityProviderConfig-OAuth2) |  |  |






<a name="memos-store-IdentityProviderConfig-FieldMapping"></a>

### IdentityProviderConfig.FieldMapping



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identifier | [string](#string) |  |  |
| display_name | [string](#string) |  |  |
| email | [string](#string) |  |  |






<a name="memos-store-IdentityProviderConfig-OAuth2"></a>

### IdentityProviderConfig.OAuth2



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| client_id | [string](#string) |  |  |
| client_secret | [string](#string) |  |  |
| auth_url | [string](#string) |  |  |
| token_url | [string](#string) |  |  |
| user_info_url | [string](#string) |  |  |
| scopes | [string](#string) | repeated |  |
| field_mapping | [IdentityProviderConfig.FieldMapping](#memos-store-IdentityProviderConfig-FieldMapping) |  |  |





 

 

 

 



<a name="store_inbox-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/inbox.proto



<a name="memos-store-InboxMessage"></a>

### InboxMessage



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| type | [InboxMessage.Type](#memos-store-InboxMessage-Type) |  |  |
| activity_id | [int32](#int32) | optional |  |





 


<a name="memos-store-InboxMessage-Type"></a>

### InboxMessage.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| TYPE_MEMO_COMMENT | 1 |  |
| TYPE_VERSION_UPDATE | 2 |  |


 

 

 



<a name="store_reaction-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/reaction.proto



<a name="memos-store-Reaction"></a>

### Reaction



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| created_ts | [int64](#int64) |  |  |
| creator_id | [int32](#int32) |  |  |
| content_id | [string](#string) |  | content_id is the id of the content that the reaction is for. This can be a memo. e.g. memos/101 |
| reaction_type | [Reaction.Type](#memos-store-Reaction-Type) |  |  |





 


<a name="memos-store-Reaction-Type"></a>

### Reaction.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| THUMBS_UP | 1 |  |
| THUMBS_DOWN | 2 |  |
| HEART | 3 |  |
| FIRE | 4 |  |
| CLAPPING_HANDS | 5 |  |
| LAUGH | 6 |  |
| OK_HAND | 7 |  |
| ROCKET | 8 |  |
| EYES | 9 |  |
| THINKING_FACE | 10 |  |
| CLOWN_FACE | 11 |  |
| QUESTION_MARK | 12 |  |


 

 

 



<a name="store_storage-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/storage.proto



<a name="memos-store-S3Config"></a>

### S3Config



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| end_point | [string](#string) |  |  |
| path | [string](#string) |  |  |
| region | [string](#string) |  |  |
| access_key | [string](#string) |  |  |
| secret_key | [string](#string) |  |  |
| bucket | [string](#string) |  |  |
| url_prefix | [string](#string) |  |  |
| url_suffix | [string](#string) |  |  |
| pre_sign | [bool](#bool) |  |  |






<a name="memos-store-Storage"></a>

### Storage



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| name | [string](#string) |  |  |
| type | [Storage.Type](#memos-store-Storage-Type) |  |  |
| config | [StorageConfig](#memos-store-StorageConfig) |  |  |






<a name="memos-store-StorageConfig"></a>

### StorageConfig



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| s3_config | [S3Config](#memos-store-S3Config) |  |  |





 


<a name="memos-store-Storage-Type"></a>

### Storage.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| S3 | 1 |  |


 

 

 



<a name="store_user_setting-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/user_setting.proto



<a name="memos-store-AccessTokensUserSetting"></a>

### AccessTokensUserSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_tokens | [AccessTokensUserSetting.AccessToken](#memos-store-AccessTokensUserSetting-AccessToken) | repeated |  |






<a name="memos-store-AccessTokensUserSetting-AccessToken"></a>

### AccessTokensUserSetting.AccessToken



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_token | [string](#string) |  | The access token is a JWT token. Including expiration time, issuer, etc. |
| description | [string](#string) |  | A description for the access token. |






<a name="memos-store-UserSetting"></a>

### UserSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user_id | [int32](#int32) |  |  |
| key | [UserSettingKey](#memos-store-UserSettingKey) |  |  |
| access_tokens | [AccessTokensUserSetting](#memos-store-AccessTokensUserSetting) |  |  |
| locale | [string](#string) |  |  |
| appearance | [string](#string) |  |  |
| memo_visibility | [string](#string) |  |  |
| telegram_user_id | [string](#string) |  |  |





 


<a name="memos-store-UserSettingKey"></a>

### UserSettingKey


| Name | Number | Description |
| ---- | ------ | ----------- |
| USER_SETTING_KEY_UNSPECIFIED | 0 |  |
| USER_SETTING_ACCESS_TOKENS | 1 | Access tokens for the user. |
| USER_SETTING_LOCALE | 2 | The locale of the user. |
| USER_SETTING_APPEARANCE | 3 | The appearance of the user. |
| USER_SETTING_MEMO_VISIBILITY | 4 | The visibility of the memo. |
| USER_SETTING_TELEGRAM_USER_ID | 5 | The telegram user id of the user. |


 

 

 



<a name="store_webhook-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/webhook.proto



<a name="memos-store-Webhook"></a>

### Webhook



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| created_ts | [int64](#int64) |  |  |
| updated_ts | [int64](#int64) |  |  |
| creator_id | [int32](#int32) |  |  |
| row_status | [RowStatus](#memos-store-RowStatus) |  |  |
| name | [string](#string) |  |  |
| url | [string](#string) |  |  |





 

 

 

 



<a name="store_workspace_setting-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## store/workspace_setting.proto



<a name="memos-store-WorkspaceBasicSetting"></a>

### WorkspaceBasicSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| server_id | [string](#string) |  |  |
| secret_key | [string](#string) |  |  |






<a name="memos-store-WorkspaceCustomProfile"></a>

### WorkspaceCustomProfile



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| title | [string](#string) |  |  |
| description | [string](#string) |  |  |
| logo_url | [string](#string) |  |  |
| locale | [string](#string) |  |  |
| appearance | [string](#string) |  |  |






<a name="memos-store-WorkspaceGeneralSetting"></a>

### WorkspaceGeneralSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| instance_url | [string](#string) |  | instance_url is the instance URL. |
| disallow_signup | [bool](#bool) |  | disallow_signup is the flag to disallow signup. |
| disallow_password_login | [bool](#bool) |  | disallow_password_login is the flag to disallow password login. |
| additional_script | [string](#string) |  | additional_script is the additional script. |
| additional_style | [string](#string) |  | additional_style is the additional style. |
| custom_profile | [WorkspaceCustomProfile](#memos-store-WorkspaceCustomProfile) |  | custom_profile is the custom profile. |






<a name="memos-store-WorkspaceMemoRelatedSetting"></a>

### WorkspaceMemoRelatedSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| disallow_public_visible | [bool](#bool) |  | disallow_public_share disallows set memo as public visible. |
| display_with_update_time | [bool](#bool) |  | display_with_update_time orders and displays memo with update time. |






<a name="memos-store-WorkspaceSetting"></a>

### WorkspaceSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| key | [WorkspaceSettingKey](#memos-store-WorkspaceSettingKey) |  |  |
| basic_setting | [WorkspaceBasicSetting](#memos-store-WorkspaceBasicSetting) |  |  |
| general_setting | [WorkspaceGeneralSetting](#memos-store-WorkspaceGeneralSetting) |  |  |
| storage_setting | [WorkspaceStorageSetting](#memos-store-WorkspaceStorageSetting) |  |  |
| memo_related_setting | [WorkspaceMemoRelatedSetting](#memos-store-WorkspaceMemoRelatedSetting) |  |  |
| telegram_integration_setting | [WorkspaceTelegramIntegrationSetting](#memos-store-WorkspaceTelegramIntegrationSetting) |  |  |






<a name="memos-store-WorkspaceStorageSetting"></a>

### WorkspaceStorageSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| storage_type | [WorkspaceStorageSetting.StorageType](#memos-store-WorkspaceStorageSetting-StorageType) |  | storage_type is the storage type. |
| actived_external_storage_id | [int32](#int32) | optional | The id of actived external storage. |
| local_storage_path | [string](#string) |  | The local storage path for STORAGE_TYPE_LOCAL. e.g. assets/{timestamp}_{filename} |
| upload_size_limit_mb | [int64](#int64) |  | The max upload size in megabytes. |






<a name="memos-store-WorkspaceTelegramIntegrationSetting"></a>

### WorkspaceTelegramIntegrationSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| bot_token | [string](#string) |  | bot_token is the telegram bot token. |





 


<a name="memos-store-WorkspaceSettingKey"></a>

### WorkspaceSettingKey


| Name | Number | Description |
| ---- | ------ | ----------- |
| WORKSPACE_SETTING_KEY_UNSPECIFIED | 0 |  |
| WORKSPACE_SETTING_BASIC | 1 | WORKSPACE_SETTING_BASIC is the key for basic settings. |
| WORKSPACE_SETTING_GENERAL | 2 | WORKSPACE_SETTING_GENERAL is the key for general settings. |
| WORKSPACE_SETTING_STORAGE | 3 | WORKSPACE_SETTING_STORAGE is the key for storage settings. |
| WORKSPACE_SETTING_MEMO_RELATED | 4 | WORKSPACE_SETTING_MEMO_RELATED is the key for memo related settings. |
| WORKSPACE_SETTING_TELEGRAM_INTEGRATION | 5 | WORKSPACE_SETTING_TELEGRAM_INTEGRATION is the key for telegram integration settings. |



<a name="memos-store-WorkspaceStorageSetting-StorageType"></a>

### WorkspaceStorageSetting.StorageType


| Name | Number | Description |
| ---- | ------ | ----------- |
| STORAGE_TYPE_UNSPECIFIED | 0 |  |
| STORAGE_TYPE_DATABASE | 1 | STORAGE_TYPE_DATABASE is the database storage type. |
| STORAGE_TYPE_LOCAL | 2 | STORAGE_TYPE_LOCAL is the local storage type. |
| STORAGE_TYPE_EXTERNAL | 3 | STORAGE_TYPE_EXTERNAL is the external storage type. |


 

 

 



## Scalar Value Types

| .proto Type | Notes | C++ | Java | Python | Go | C# | PHP | Ruby |
| ----------- | ----- | --- | ---- | ------ | -- | -- | --- | ---- |
| <a name="double" /> double |  | double | double | float | float64 | double | float | Float |
| <a name="float" /> float |  | float | float | float | float32 | float | float | Float |
| <a name="int32" /> int32 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint32 instead. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="int64" /> int64 | Uses variable-length encoding. Inefficient for encoding negative numbers – if your field is likely to have negative values, use sint64 instead. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="uint32" /> uint32 | Uses variable-length encoding. | uint32 | int | int/long | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="uint64" /> uint64 | Uses variable-length encoding. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum or Fixnum (as required) |
| <a name="sint32" /> sint32 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int32s. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sint64" /> sint64 | Uses variable-length encoding. Signed int value. These more efficiently encode negative numbers than regular int64s. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="fixed32" /> fixed32 | Always four bytes. More efficient than uint32 if values are often greater than 2^28. | uint32 | int | int | uint32 | uint | integer | Bignum or Fixnum (as required) |
| <a name="fixed64" /> fixed64 | Always eight bytes. More efficient than uint64 if values are often greater than 2^56. | uint64 | long | int/long | uint64 | ulong | integer/string | Bignum |
| <a name="sfixed32" /> sfixed32 | Always four bytes. | int32 | int | int | int32 | int | integer | Bignum or Fixnum (as required) |
| <a name="sfixed64" /> sfixed64 | Always eight bytes. | int64 | long | int/long | int64 | long | integer/string | Bignum |
| <a name="bool" /> bool |  | bool | boolean | boolean | bool | bool | boolean | TrueClass/FalseClass |
| <a name="string" /> string | A string must always contain UTF-8 encoded or 7-bit ASCII text. | string | String | str/unicode | string | string | string | String (UTF-8) |
| <a name="bytes" /> bytes | May contain any arbitrary sequence of bytes. | string | ByteString | str | []byte | ByteString | string | String (ASCII-8BIT) |

