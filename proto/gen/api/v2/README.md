# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [api/v2/common.proto](#api_v2_common-proto)
    - [RowStatus](#memos-api-v2-RowStatus)
  
- [api/v2/memo_service.proto](#api_v2_memo_service-proto)
    - [GetMemoRequest](#memos-api-v2-GetMemoRequest)
    - [GetMemoResponse](#memos-api-v2-GetMemoResponse)
    - [ListMemosRequest](#memos-api-v2-ListMemosRequest)
    - [ListMemosResponse](#memos-api-v2-ListMemosResponse)
    - [Memo](#memos-api-v2-Memo)
  
    - [Visibility](#memos-api-v2-Visibility)
  
    - [MemoService](#memos-api-v2-MemoService)
  
- [api/v2/resource_service.proto](#api_v2_resource_service-proto)
    - [ListResourcesRequest](#memos-api-v2-ListResourcesRequest)
    - [ListResourcesResponse](#memos-api-v2-ListResourcesResponse)
    - [Resource](#memos-api-v2-Resource)
  
    - [ResourceService](#memos-api-v2-ResourceService)
  
- [api/v2/system_service.proto](#api_v2_system_service-proto)
    - [GetSystemInfoRequest](#memos-api-v2-GetSystemInfoRequest)
    - [GetSystemInfoResponse](#memos-api-v2-GetSystemInfoResponse)
    - [SystemInfo](#memos-api-v2-SystemInfo)
    - [UpdateSystemInfoRequest](#memos-api-v2-UpdateSystemInfoRequest)
    - [UpdateSystemInfoResponse](#memos-api-v2-UpdateSystemInfoResponse)
  
    - [SystemService](#memos-api-v2-SystemService)
  
- [api/v2/tag_service.proto](#api_v2_tag_service-proto)
    - [ListTagsRequest](#memos-api-v2-ListTagsRequest)
    - [ListTagsResponse](#memos-api-v2-ListTagsResponse)
    - [Tag](#memos-api-v2-Tag)
  
    - [TagService](#memos-api-v2-TagService)
  
- [api/v2/user_service.proto](#api_v2_user_service-proto)
    - [CreateUserAccessTokenRequest](#memos-api-v2-CreateUserAccessTokenRequest)
    - [CreateUserAccessTokenResponse](#memos-api-v2-CreateUserAccessTokenResponse)
    - [DeleteUserAccessTokenRequest](#memos-api-v2-DeleteUserAccessTokenRequest)
    - [DeleteUserAccessTokenResponse](#memos-api-v2-DeleteUserAccessTokenResponse)
    - [GetUserRequest](#memos-api-v2-GetUserRequest)
    - [GetUserResponse](#memos-api-v2-GetUserResponse)
    - [ListUserAccessTokensRequest](#memos-api-v2-ListUserAccessTokensRequest)
    - [ListUserAccessTokensResponse](#memos-api-v2-ListUserAccessTokensResponse)
    - [UpdateUserRequest](#memos-api-v2-UpdateUserRequest)
    - [UpdateUserResponse](#memos-api-v2-UpdateUserResponse)
    - [User](#memos-api-v2-User)
    - [UserAccessToken](#memos-api-v2-UserAccessToken)
  
    - [User.Role](#memos-api-v2-User-Role)
  
    - [UserService](#memos-api-v2-UserService)
  
- [Scalar Value Types](#scalar-value-types)



<a name="api_v2_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/common.proto


 


<a name="memos-api-v2-RowStatus"></a>

### RowStatus


| Name | Number | Description |
| ---- | ------ | ----------- |
| ROW_STATUS_UNSPECIFIED | 0 |  |
| ACTIVE | 1 |  |
| ARCHIVED | 2 |  |


 

 

 



<a name="api_v2_memo_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/memo_service.proto



<a name="memos-api-v2-GetMemoRequest"></a>

### GetMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-GetMemoResponse"></a>

### GetMemoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |






<a name="memos-api-v2-ListMemosRequest"></a>

### ListMemosRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page | [int32](#int32) |  |  |
| page_size | [int32](#int32) |  |  |
| filter | [string](#string) |  | Filter is used to filter memos returned in the list. |






<a name="memos-api-v2-ListMemosResponse"></a>

### ListMemosResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memos | [Memo](#memos-api-v2-Memo) | repeated |  |






<a name="memos-api-v2-Memo"></a>

### Memo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| row_status | [RowStatus](#memos-api-v2-RowStatus) |  |  |
| creator_id | [int32](#int32) |  |  |
| created_ts | [int64](#int64) |  |  |
| updated_ts | [int64](#int64) |  |  |
| content | [string](#string) |  |  |
| visibility | [Visibility](#memos-api-v2-Visibility) |  |  |
| pinned | [bool](#bool) |  |  |





 


<a name="memos-api-v2-Visibility"></a>

### Visibility


| Name | Number | Description |
| ---- | ------ | ----------- |
| VISIBILITY_UNSPECIFIED | 0 |  |
| PRIVATE | 1 |  |
| PROTECTED | 2 |  |
| PUBLIC | 3 |  |


 

 


<a name="memos-api-v2-MemoService"></a>

### MemoService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListMemos | [ListMemosRequest](#memos-api-v2-ListMemosRequest) | [ListMemosResponse](#memos-api-v2-ListMemosResponse) |  |
| GetMemo | [GetMemoRequest](#memos-api-v2-GetMemoRequest) | [GetMemoResponse](#memos-api-v2-GetMemoResponse) |  |

 



<a name="api_v2_resource_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/resource_service.proto



<a name="memos-api-v2-ListResourcesRequest"></a>

### ListResourcesRequest







<a name="memos-api-v2-ListResourcesResponse"></a>

### ListResourcesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






<a name="memos-api-v2-Resource"></a>

### Resource



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| created_ts | [int64](#int64) |  |  |
| filename | [string](#string) |  |  |
| external_link | [string](#string) |  |  |
| type | [string](#string) |  |  |
| size | [int64](#int64) |  |  |
| related_memo_id | [int32](#int32) | optional |  |





 

 

 


<a name="memos-api-v2-ResourceService"></a>

### ResourceService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListResources | [ListResourcesRequest](#memos-api-v2-ListResourcesRequest) | [ListResourcesResponse](#memos-api-v2-ListResourcesResponse) |  |

 



<a name="api_v2_system_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/system_service.proto



<a name="memos-api-v2-GetSystemInfoRequest"></a>

### GetSystemInfoRequest







<a name="memos-api-v2-GetSystemInfoResponse"></a>

### GetSystemInfoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| system_info | [SystemInfo](#memos-api-v2-SystemInfo) |  |  |






<a name="memos-api-v2-SystemInfo"></a>

### SystemInfo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| version | [string](#string) |  |  |
| mode | [string](#string) |  |  |
| allow_registration | [bool](#bool) |  |  |
| disable_password_login | [bool](#bool) |  |  |
| additional_script | [string](#string) |  |  |
| additional_style | [string](#string) |  |  |
| db_size | [int64](#int64) |  |  |






<a name="memos-api-v2-UpdateSystemInfoRequest"></a>

### UpdateSystemInfoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| system_info | [SystemInfo](#memos-api-v2-SystemInfo) |  | System info is the updated data. |
| update_mask | [string](#string) | repeated | Update mask is the array of paths. |






<a name="memos-api-v2-UpdateSystemInfoResponse"></a>

### UpdateSystemInfoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| system_info | [SystemInfo](#memos-api-v2-SystemInfo) |  |  |





 

 

 


<a name="memos-api-v2-SystemService"></a>

### SystemService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetSystemInfo | [GetSystemInfoRequest](#memos-api-v2-GetSystemInfoRequest) | [GetSystemInfoResponse](#memos-api-v2-GetSystemInfoResponse) |  |
| UpdateSystemInfo | [UpdateSystemInfoRequest](#memos-api-v2-UpdateSystemInfoRequest) | [UpdateSystemInfoResponse](#memos-api-v2-UpdateSystemInfoResponse) |  |

 



<a name="api_v2_tag_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/tag_service.proto



<a name="memos-api-v2-ListTagsRequest"></a>

### ListTagsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| creator_id | [int32](#int32) |  |  |






<a name="memos-api-v2-ListTagsResponse"></a>

### ListTagsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tags | [Tag](#memos-api-v2-Tag) | repeated |  |






<a name="memos-api-v2-Tag"></a>

### Tag



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  |  |
| creator_id | [int32](#int32) |  |  |





 

 

 


<a name="memos-api-v2-TagService"></a>

### TagService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListTags | [ListTagsRequest](#memos-api-v2-ListTagsRequest) | [ListTagsResponse](#memos-api-v2-ListTagsResponse) |  |

 



<a name="api_v2_user_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/user_service.proto



<a name="memos-api-v2-CreateUserAccessTokenRequest"></a>

### CreateUserAccessTokenRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |
| user_access_token | [UserAccessToken](#memos-api-v2-UserAccessToken) |  |  |






<a name="memos-api-v2-CreateUserAccessTokenResponse"></a>

### CreateUserAccessTokenResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_token | [UserAccessToken](#memos-api-v2-UserAccessToken) |  |  |






<a name="memos-api-v2-DeleteUserAccessTokenRequest"></a>

### DeleteUserAccessTokenRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |
| access_token | [string](#string) |  | access_token is the access token to delete. |






<a name="memos-api-v2-DeleteUserAccessTokenResponse"></a>

### DeleteUserAccessTokenResponse







<a name="memos-api-v2-GetUserRequest"></a>

### GetUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |






<a name="memos-api-v2-GetUserResponse"></a>

### GetUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-ListUserAccessTokensRequest"></a>

### ListUserAccessTokensRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |






<a name="memos-api-v2-ListUserAccessTokensResponse"></a>

### ListUserAccessTokensResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_tokens | [UserAccessToken](#memos-api-v2-UserAccessToken) | repeated |  |






<a name="memos-api-v2-UpdateUserRequest"></a>

### UpdateUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |
| user | [User](#memos-api-v2-User) |  |  |
| update_mask | [string](#string) | repeated | The update mask applies to the user resource. |






<a name="memos-api-v2-UpdateUserResponse"></a>

### UpdateUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-User"></a>

### User



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| username | [string](#string) |  |  |
| role | [User.Role](#memos-api-v2-User-Role) |  |  |
| email | [string](#string) |  |  |
| nickname | [string](#string) |  |  |
| avatar_url | [string](#string) |  |  |
| password | [string](#string) |  |  |
| row_status | [RowStatus](#memos-api-v2-RowStatus) |  |  |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| update_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |






<a name="memos-api-v2-UserAccessToken"></a>

### UserAccessToken



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_token | [string](#string) |  |  |
| description | [string](#string) |  |  |
| issued_at | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| expires_at | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |





 


<a name="memos-api-v2-User-Role"></a>

### User.Role


| Name | Number | Description |
| ---- | ------ | ----------- |
| ROLE_UNSPECIFIED | 0 |  |
| HOST | 1 |  |
| ADMIN | 2 |  |
| USER | 3 |  |


 

 


<a name="memos-api-v2-UserService"></a>

### UserService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetUser | [GetUserRequest](#memos-api-v2-GetUserRequest) | [GetUserResponse](#memos-api-v2-GetUserResponse) |  |
| UpdateUser | [UpdateUserRequest](#memos-api-v2-UpdateUserRequest) | [UpdateUserResponse](#memos-api-v2-UpdateUserResponse) |  |
| ListUserAccessTokens | [ListUserAccessTokensRequest](#memos-api-v2-ListUserAccessTokensRequest) | [ListUserAccessTokensResponse](#memos-api-v2-ListUserAccessTokensResponse) | ListUserAccessTokens returns a list of access tokens for a user. |
| CreateUserAccessToken | [CreateUserAccessTokenRequest](#memos-api-v2-CreateUserAccessTokenRequest) | [CreateUserAccessTokenResponse](#memos-api-v2-CreateUserAccessTokenResponse) | CreateUserAccessToken creates a new access token for a user. |
| DeleteUserAccessToken | [DeleteUserAccessTokenRequest](#memos-api-v2-DeleteUserAccessTokenRequest) | [DeleteUserAccessTokenResponse](#memos-api-v2-DeleteUserAccessTokenResponse) | DeleteUserAccessToken deletes an access token for a user. |

 



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

