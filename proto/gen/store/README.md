# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [store/activity.proto](#store_activity-proto)
    - [ActivityMemoCommentPayload](#memos-store-ActivityMemoCommentPayload)
    - [ActivityPayload](#memos-store-ActivityPayload)
    - [ActivityVersionUpdatePayload](#memos-store-ActivityVersionUpdatePayload)
  
- [store/common.proto](#store_common-proto)
    - [RowStatus](#memos-store-RowStatus)
  
- [store/inbox.proto](#store_inbox-proto)
    - [InboxMessage](#memos-store-InboxMessage)
  
    - [InboxMessage.Type](#memos-store-InboxMessage-Type)
  
- [store/user_setting.proto](#store_user_setting-proto)
    - [AccessTokensUserSetting](#memos-store-AccessTokensUserSetting)
    - [AccessTokensUserSetting.AccessToken](#memos-store-AccessTokensUserSetting-AccessToken)
    - [UserSetting](#memos-store-UserSetting)
  
    - [UserSettingKey](#memos-store-UserSettingKey)
  
- [store/webhook.proto](#store_webhook-proto)
    - [Webhook](#memos-store-Webhook)
  
- [store/workspace_setting.proto](#store_workspace_setting-proto)
    - [WorkspaceProfileSetting](#memos-store-WorkspaceProfileSetting)
  
    - [WorkspaceSettingKey](#memos-store-WorkspaceSettingKey)
  
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



<a name="memos-store-WorkspaceProfileSetting"></a>

### WorkspaceProfileSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| instance_url | [string](#string) |  |  |
| disallow_signup | [bool](#bool) |  |  |





 


<a name="memos-store-WorkspaceSettingKey"></a>

### WorkspaceSettingKey


| Name | Number | Description |
| ---- | ------ | ----------- |
| WORKSPACE_SETTING_KEY_UNSPECIFIED | 0 |  |
| WORKSPACE_SETTING_PROFILE | 1 |  |


 

 

 



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

