# Protocol Documentation
<a name="top"></a>

## Table of Contents

- [api/v2/activity_service.proto](#api_v2_activity_service-proto)
    - [Activity](#memos-api-v2-Activity)
    - [ActivityMemoCommentPayload](#memos-api-v2-ActivityMemoCommentPayload)
    - [ActivityPayload](#memos-api-v2-ActivityPayload)
    - [ActivityVersionUpdatePayload](#memos-api-v2-ActivityVersionUpdatePayload)
    - [GetActivityRequest](#memos-api-v2-GetActivityRequest)
    - [GetActivityResponse](#memos-api-v2-GetActivityResponse)
  
    - [ActivityService](#memos-api-v2-ActivityService)
  
- [api/v2/common.proto](#api_v2_common-proto)
    - [RowStatus](#memos-api-v2-RowStatus)
  
- [api/v2/user_service.proto](#api_v2_user_service-proto)
    - [CreateUserAccessTokenRequest](#memos-api-v2-CreateUserAccessTokenRequest)
    - [CreateUserAccessTokenResponse](#memos-api-v2-CreateUserAccessTokenResponse)
    - [CreateUserRequest](#memos-api-v2-CreateUserRequest)
    - [CreateUserResponse](#memos-api-v2-CreateUserResponse)
    - [DeleteUserAccessTokenRequest](#memos-api-v2-DeleteUserAccessTokenRequest)
    - [DeleteUserAccessTokenResponse](#memos-api-v2-DeleteUserAccessTokenResponse)
    - [DeleteUserRequest](#memos-api-v2-DeleteUserRequest)
    - [DeleteUserResponse](#memos-api-v2-DeleteUserResponse)
    - [GetUserRequest](#memos-api-v2-GetUserRequest)
    - [GetUserResponse](#memos-api-v2-GetUserResponse)
    - [GetUserSettingRequest](#memos-api-v2-GetUserSettingRequest)
    - [GetUserSettingResponse](#memos-api-v2-GetUserSettingResponse)
    - [ListUserAccessTokensRequest](#memos-api-v2-ListUserAccessTokensRequest)
    - [ListUserAccessTokensResponse](#memos-api-v2-ListUserAccessTokensResponse)
    - [ListUsersRequest](#memos-api-v2-ListUsersRequest)
    - [ListUsersResponse](#memos-api-v2-ListUsersResponse)
    - [UpdateUserRequest](#memos-api-v2-UpdateUserRequest)
    - [UpdateUserResponse](#memos-api-v2-UpdateUserResponse)
    - [UpdateUserSettingRequest](#memos-api-v2-UpdateUserSettingRequest)
    - [UpdateUserSettingResponse](#memos-api-v2-UpdateUserSettingResponse)
    - [User](#memos-api-v2-User)
    - [UserAccessToken](#memos-api-v2-UserAccessToken)
    - [UserSetting](#memos-api-v2-UserSetting)
  
    - [User.Role](#memos-api-v2-User-Role)
  
    - [UserService](#memos-api-v2-UserService)
  
- [api/v2/auth_service.proto](#api_v2_auth_service-proto)
    - [GetAuthStatusRequest](#memos-api-v2-GetAuthStatusRequest)
    - [GetAuthStatusResponse](#memos-api-v2-GetAuthStatusResponse)
  
    - [AuthService](#memos-api-v2-AuthService)
  
- [api/v2/inbox_service.proto](#api_v2_inbox_service-proto)
    - [DeleteInboxRequest](#memos-api-v2-DeleteInboxRequest)
    - [DeleteInboxResponse](#memos-api-v2-DeleteInboxResponse)
    - [Inbox](#memos-api-v2-Inbox)
    - [ListInboxesRequest](#memos-api-v2-ListInboxesRequest)
    - [ListInboxesResponse](#memos-api-v2-ListInboxesResponse)
    - [UpdateInboxRequest](#memos-api-v2-UpdateInboxRequest)
    - [UpdateInboxResponse](#memos-api-v2-UpdateInboxResponse)
  
    - [Inbox.Status](#memos-api-v2-Inbox-Status)
    - [Inbox.Type](#memos-api-v2-Inbox-Type)
  
    - [InboxService](#memos-api-v2-InboxService)
  
- [api/v2/markdown_service.proto](#api_v2_markdown_service-proto)
    - [AutoLinkNode](#memos-api-v2-AutoLinkNode)
    - [BlockquoteNode](#memos-api-v2-BlockquoteNode)
    - [BoldItalicNode](#memos-api-v2-BoldItalicNode)
    - [BoldNode](#memos-api-v2-BoldNode)
    - [CodeBlockNode](#memos-api-v2-CodeBlockNode)
    - [CodeNode](#memos-api-v2-CodeNode)
    - [EscapingCharacterNode](#memos-api-v2-EscapingCharacterNode)
    - [HeadingNode](#memos-api-v2-HeadingNode)
    - [HighlightNode](#memos-api-v2-HighlightNode)
    - [HorizontalRuleNode](#memos-api-v2-HorizontalRuleNode)
    - [ImageNode](#memos-api-v2-ImageNode)
    - [ItalicNode](#memos-api-v2-ItalicNode)
    - [LineBreakNode](#memos-api-v2-LineBreakNode)
    - [LinkNode](#memos-api-v2-LinkNode)
    - [MathBlockNode](#memos-api-v2-MathBlockNode)
    - [MathNode](#memos-api-v2-MathNode)
    - [Node](#memos-api-v2-Node)
    - [OrderedListNode](#memos-api-v2-OrderedListNode)
    - [ParagraphNode](#memos-api-v2-ParagraphNode)
    - [ParseMarkdownRequest](#memos-api-v2-ParseMarkdownRequest)
    - [ParseMarkdownResponse](#memos-api-v2-ParseMarkdownResponse)
    - [StrikethroughNode](#memos-api-v2-StrikethroughNode)
    - [SubscriptNode](#memos-api-v2-SubscriptNode)
    - [SuperscriptNode](#memos-api-v2-SuperscriptNode)
    - [TableNode](#memos-api-v2-TableNode)
    - [TableNode.Row](#memos-api-v2-TableNode-Row)
    - [TagNode](#memos-api-v2-TagNode)
    - [TaskListNode](#memos-api-v2-TaskListNode)
    - [TextNode](#memos-api-v2-TextNode)
    - [UnorderedListNode](#memos-api-v2-UnorderedListNode)
  
    - [NodeType](#memos-api-v2-NodeType)
  
    - [MarkdownService](#memos-api-v2-MarkdownService)
  
- [api/v2/memo_relation_service.proto](#api_v2_memo_relation_service-proto)
    - [MemoRelation](#memos-api-v2-MemoRelation)
  
    - [MemoRelation.Type](#memos-api-v2-MemoRelation-Type)
  
- [api/v2/resource_service.proto](#api_v2_resource_service-proto)
    - [CreateResourceRequest](#memos-api-v2-CreateResourceRequest)
    - [CreateResourceResponse](#memos-api-v2-CreateResourceResponse)
    - [DeleteResourceRequest](#memos-api-v2-DeleteResourceRequest)
    - [DeleteResourceResponse](#memos-api-v2-DeleteResourceResponse)
    - [ListResourcesRequest](#memos-api-v2-ListResourcesRequest)
    - [ListResourcesResponse](#memos-api-v2-ListResourcesResponse)
    - [Resource](#memos-api-v2-Resource)
    - [UpdateResourceRequest](#memos-api-v2-UpdateResourceRequest)
    - [UpdateResourceResponse](#memos-api-v2-UpdateResourceResponse)
  
    - [ResourceService](#memos-api-v2-ResourceService)
  
- [api/v2/memo_service.proto](#api_v2_memo_service-proto)
    - [CreateMemoCommentRequest](#memos-api-v2-CreateMemoCommentRequest)
    - [CreateMemoCommentResponse](#memos-api-v2-CreateMemoCommentResponse)
    - [CreateMemoRequest](#memos-api-v2-CreateMemoRequest)
    - [CreateMemoResponse](#memos-api-v2-CreateMemoResponse)
    - [DeleteMemoRequest](#memos-api-v2-DeleteMemoRequest)
    - [DeleteMemoResponse](#memos-api-v2-DeleteMemoResponse)
    - [GetMemoRequest](#memos-api-v2-GetMemoRequest)
    - [GetMemoResponse](#memos-api-v2-GetMemoResponse)
    - [GetUserMemosStatsRequest](#memos-api-v2-GetUserMemosStatsRequest)
    - [GetUserMemosStatsResponse](#memos-api-v2-GetUserMemosStatsResponse)
    - [GetUserMemosStatsResponse.StatsEntry](#memos-api-v2-GetUserMemosStatsResponse-StatsEntry)
    - [ListMemoCommentsRequest](#memos-api-v2-ListMemoCommentsRequest)
    - [ListMemoCommentsResponse](#memos-api-v2-ListMemoCommentsResponse)
    - [ListMemoRelationsRequest](#memos-api-v2-ListMemoRelationsRequest)
    - [ListMemoRelationsResponse](#memos-api-v2-ListMemoRelationsResponse)
    - [ListMemoResourcesRequest](#memos-api-v2-ListMemoResourcesRequest)
    - [ListMemoResourcesResponse](#memos-api-v2-ListMemoResourcesResponse)
    - [ListMemosRequest](#memos-api-v2-ListMemosRequest)
    - [ListMemosResponse](#memos-api-v2-ListMemosResponse)
    - [Memo](#memos-api-v2-Memo)
    - [SetMemoRelationsRequest](#memos-api-v2-SetMemoRelationsRequest)
    - [SetMemoRelationsResponse](#memos-api-v2-SetMemoRelationsResponse)
    - [SetMemoResourcesRequest](#memos-api-v2-SetMemoResourcesRequest)
    - [SetMemoResourcesResponse](#memos-api-v2-SetMemoResourcesResponse)
    - [UpdateMemoRequest](#memos-api-v2-UpdateMemoRequest)
    - [UpdateMemoResponse](#memos-api-v2-UpdateMemoResponse)
  
    - [Visibility](#memos-api-v2-Visibility)
  
    - [MemoService](#memos-api-v2-MemoService)
  
- [api/v2/system_service.proto](#api_v2_system_service-proto)
    - [GetSystemInfoRequest](#memos-api-v2-GetSystemInfoRequest)
    - [GetSystemInfoResponse](#memos-api-v2-GetSystemInfoResponse)
    - [SystemInfo](#memos-api-v2-SystemInfo)
    - [UpdateSystemInfoRequest](#memos-api-v2-UpdateSystemInfoRequest)
    - [UpdateSystemInfoResponse](#memos-api-v2-UpdateSystemInfoResponse)
  
    - [SystemService](#memos-api-v2-SystemService)
  
- [api/v2/tag_service.proto](#api_v2_tag_service-proto)
    - [DeleteTagRequest](#memos-api-v2-DeleteTagRequest)
    - [DeleteTagResponse](#memos-api-v2-DeleteTagResponse)
    - [GetTagSuggestionsRequest](#memos-api-v2-GetTagSuggestionsRequest)
    - [GetTagSuggestionsResponse](#memos-api-v2-GetTagSuggestionsResponse)
    - [ListTagsRequest](#memos-api-v2-ListTagsRequest)
    - [ListTagsResponse](#memos-api-v2-ListTagsResponse)
    - [Tag](#memos-api-v2-Tag)
    - [UpsertTagRequest](#memos-api-v2-UpsertTagRequest)
    - [UpsertTagResponse](#memos-api-v2-UpsertTagResponse)
  
    - [TagService](#memos-api-v2-TagService)
  
- [api/v2/webhook_service.proto](#api_v2_webhook_service-proto)
    - [CreateWebhookRequest](#memos-api-v2-CreateWebhookRequest)
    - [CreateWebhookResponse](#memos-api-v2-CreateWebhookResponse)
    - [DeleteWebhookRequest](#memos-api-v2-DeleteWebhookRequest)
    - [DeleteWebhookResponse](#memos-api-v2-DeleteWebhookResponse)
    - [GetWebhookRequest](#memos-api-v2-GetWebhookRequest)
    - [GetWebhookResponse](#memos-api-v2-GetWebhookResponse)
    - [ListWebhooksRequest](#memos-api-v2-ListWebhooksRequest)
    - [ListWebhooksResponse](#memos-api-v2-ListWebhooksResponse)
    - [UpdateWebhookRequest](#memos-api-v2-UpdateWebhookRequest)
    - [UpdateWebhookResponse](#memos-api-v2-UpdateWebhookResponse)
    - [Webhook](#memos-api-v2-Webhook)
  
    - [WebhookService](#memos-api-v2-WebhookService)
  
- [Scalar Value Types](#scalar-value-types)



<a name="api_v2_activity_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/activity_service.proto



<a name="memos-api-v2-Activity"></a>

### Activity



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| creator_id | [int32](#int32) |  |  |
| type | [string](#string) |  |  |
| level | [string](#string) |  |  |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| payload | [ActivityPayload](#memos-api-v2-ActivityPayload) |  |  |






<a name="memos-api-v2-ActivityMemoCommentPayload"></a>

### ActivityMemoCommentPayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo_id | [int32](#int32) |  |  |
| related_memo_id | [int32](#int32) |  |  |






<a name="memos-api-v2-ActivityPayload"></a>

### ActivityPayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo_comment | [ActivityMemoCommentPayload](#memos-api-v2-ActivityMemoCommentPayload) |  |  |
| version_update | [ActivityVersionUpdatePayload](#memos-api-v2-ActivityVersionUpdatePayload) |  |  |






<a name="memos-api-v2-ActivityVersionUpdatePayload"></a>

### ActivityVersionUpdatePayload



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| version | [string](#string) |  |  |






<a name="memos-api-v2-GetActivityRequest"></a>

### GetActivityRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-GetActivityResponse"></a>

### GetActivityResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| activity | [Activity](#memos-api-v2-Activity) |  |  |





 

 

 


<a name="memos-api-v2-ActivityService"></a>

### ActivityService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetActivity | [GetActivityRequest](#memos-api-v2-GetActivityRequest) | [GetActivityResponse](#memos-api-v2-GetActivityResponse) |  |

 



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


 

 

 



<a name="api_v2_user_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/user_service.proto



<a name="memos-api-v2-CreateUserAccessTokenRequest"></a>

### CreateUserAccessTokenRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |
| description | [string](#string) |  |  |
| expires_at | [google.protobuf.Timestamp](#google-protobuf-Timestamp) | optional |  |






<a name="memos-api-v2-CreateUserAccessTokenResponse"></a>

### CreateUserAccessTokenResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_token | [UserAccessToken](#memos-api-v2-UserAccessToken) |  |  |






<a name="memos-api-v2-CreateUserRequest"></a>

### CreateUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-CreateUserResponse"></a>

### CreateUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-DeleteUserAccessTokenRequest"></a>

### DeleteUserAccessTokenRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |
| access_token | [string](#string) |  | access_token is the access token to delete. |






<a name="memos-api-v2-DeleteUserAccessTokenResponse"></a>

### DeleteUserAccessTokenResponse







<a name="memos-api-v2-DeleteUserRequest"></a>

### DeleteUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |






<a name="memos-api-v2-DeleteUserResponse"></a>

### DeleteUserResponse







<a name="memos-api-v2-GetUserRequest"></a>

### GetUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |






<a name="memos-api-v2-GetUserResponse"></a>

### GetUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-GetUserSettingRequest"></a>

### GetUserSettingRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |






<a name="memos-api-v2-GetUserSettingResponse"></a>

### GetUserSettingResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [UserSetting](#memos-api-v2-UserSetting) |  |  |






<a name="memos-api-v2-ListUserAccessTokensRequest"></a>

### ListUserAccessTokensRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |






<a name="memos-api-v2-ListUserAccessTokensResponse"></a>

### ListUserAccessTokensResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| access_tokens | [UserAccessToken](#memos-api-v2-UserAccessToken) | repeated |  |






<a name="memos-api-v2-ListUsersRequest"></a>

### ListUsersRequest







<a name="memos-api-v2-ListUsersResponse"></a>

### ListUsersResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| users | [User](#memos-api-v2-User) | repeated |  |






<a name="memos-api-v2-UpdateUserRequest"></a>

### UpdateUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateUserResponse"></a>

### UpdateUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-UpdateUserSettingRequest"></a>

### UpdateUserSettingRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [UserSetting](#memos-api-v2-UserSetting) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateUserSettingResponse"></a>

### UpdateUserSettingResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [UserSetting](#memos-api-v2-UserSetting) |  |  |






<a name="memos-api-v2-User"></a>

### User



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |
| id | [int32](#int32) |  |  |
| role | [User.Role](#memos-api-v2-User-Role) |  |  |
| username | [string](#string) |  |  |
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






<a name="memos-api-v2-UserSetting"></a>

### UserSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{username} |
| locale | [string](#string) |  | The preferred locale of the user. |
| appearance | [string](#string) |  | The preferred appearance of the user. |
| memo_visibility | [string](#string) |  | The default visibility of the memo. |
| telegram_user_id | [string](#string) |  | The telegram user id of the user. |





 


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
| ListUsers | [ListUsersRequest](#memos-api-v2-ListUsersRequest) | [ListUsersResponse](#memos-api-v2-ListUsersResponse) | ListUsers returns a list of users. |
| GetUser | [GetUserRequest](#memos-api-v2-GetUserRequest) | [GetUserResponse](#memos-api-v2-GetUserResponse) | GetUser gets a user by name. |
| CreateUser | [CreateUserRequest](#memos-api-v2-CreateUserRequest) | [CreateUserResponse](#memos-api-v2-CreateUserResponse) | CreateUser creates a new user. |
| UpdateUser | [UpdateUserRequest](#memos-api-v2-UpdateUserRequest) | [UpdateUserResponse](#memos-api-v2-UpdateUserResponse) | UpdateUser updates a user. |
| DeleteUser | [DeleteUserRequest](#memos-api-v2-DeleteUserRequest) | [DeleteUserResponse](#memos-api-v2-DeleteUserResponse) | DeleteUser deletes a user. |
| GetUserSetting | [GetUserSettingRequest](#memos-api-v2-GetUserSettingRequest) | [GetUserSettingResponse](#memos-api-v2-GetUserSettingResponse) |  |
| UpdateUserSetting | [UpdateUserSettingRequest](#memos-api-v2-UpdateUserSettingRequest) | [UpdateUserSettingResponse](#memos-api-v2-UpdateUserSettingResponse) |  |
| ListUserAccessTokens | [ListUserAccessTokensRequest](#memos-api-v2-ListUserAccessTokensRequest) | [ListUserAccessTokensResponse](#memos-api-v2-ListUserAccessTokensResponse) | ListUserAccessTokens returns a list of access tokens for a user. |
| CreateUserAccessToken | [CreateUserAccessTokenRequest](#memos-api-v2-CreateUserAccessTokenRequest) | [CreateUserAccessTokenResponse](#memos-api-v2-CreateUserAccessTokenResponse) | CreateUserAccessToken creates a new access token for a user. |
| DeleteUserAccessToken | [DeleteUserAccessTokenRequest](#memos-api-v2-DeleteUserAccessTokenRequest) | [DeleteUserAccessTokenResponse](#memos-api-v2-DeleteUserAccessTokenResponse) | DeleteUserAccessToken deletes an access token for a user. |

 



<a name="api_v2_auth_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/auth_service.proto



<a name="memos-api-v2-GetAuthStatusRequest"></a>

### GetAuthStatusRequest







<a name="memos-api-v2-GetAuthStatusResponse"></a>

### GetAuthStatusResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |





 

 

 


<a name="memos-api-v2-AuthService"></a>

### AuthService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetAuthStatus | [GetAuthStatusRequest](#memos-api-v2-GetAuthStatusRequest) | [GetAuthStatusResponse](#memos-api-v2-GetAuthStatusResponse) |  |

 



<a name="api_v2_inbox_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/inbox_service.proto



<a name="memos-api-v2-DeleteInboxRequest"></a>

### DeleteInboxRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the inbox to delete. Format: inboxes/{inbox} |






<a name="memos-api-v2-DeleteInboxResponse"></a>

### DeleteInboxResponse







<a name="memos-api-v2-Inbox"></a>

### Inbox



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the inbox. Format: inboxes/{id} |
| sender | [string](#string) |  | Format: users/{username} |
| receiver | [string](#string) |  | Format: users/{username} |
| status | [Inbox.Status](#memos-api-v2-Inbox-Status) |  |  |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| type | [Inbox.Type](#memos-api-v2-Inbox-Type) |  |  |
| activity_id | [int32](#int32) | optional |  |






<a name="memos-api-v2-ListInboxesRequest"></a>

### ListInboxesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | Format: users/{username} |






<a name="memos-api-v2-ListInboxesResponse"></a>

### ListInboxesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| inboxes | [Inbox](#memos-api-v2-Inbox) | repeated |  |






<a name="memos-api-v2-UpdateInboxRequest"></a>

### UpdateInboxRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| inbox | [Inbox](#memos-api-v2-Inbox) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateInboxResponse"></a>

### UpdateInboxResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| inbox | [Inbox](#memos-api-v2-Inbox) |  |  |





 


<a name="memos-api-v2-Inbox-Status"></a>

### Inbox.Status


| Name | Number | Description |
| ---- | ------ | ----------- |
| STATUS_UNSPECIFIED | 0 |  |
| UNREAD | 1 |  |
| ARCHIVED | 2 |  |



<a name="memos-api-v2-Inbox-Type"></a>

### Inbox.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| TYPE_MEMO_COMMENT | 1 |  |
| TYPE_VERSION_UPDATE | 2 |  |


 

 


<a name="memos-api-v2-InboxService"></a>

### InboxService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListInboxes | [ListInboxesRequest](#memos-api-v2-ListInboxesRequest) | [ListInboxesResponse](#memos-api-v2-ListInboxesResponse) |  |
| UpdateInbox | [UpdateInboxRequest](#memos-api-v2-UpdateInboxRequest) | [UpdateInboxResponse](#memos-api-v2-UpdateInboxResponse) |  |
| DeleteInbox | [DeleteInboxRequest](#memos-api-v2-DeleteInboxRequest) | [DeleteInboxResponse](#memos-api-v2-DeleteInboxResponse) |  |

 



<a name="api_v2_markdown_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/markdown_service.proto



<a name="memos-api-v2-AutoLinkNode"></a>

### AutoLinkNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| url | [string](#string) |  |  |
| is_raw_text | [bool](#bool) |  |  |






<a name="memos-api-v2-BlockquoteNode"></a>

### BlockquoteNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-BoldItalicNode"></a>

### BoldItalicNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |
| content | [string](#string) |  |  |






<a name="memos-api-v2-BoldNode"></a>

### BoldNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-CodeBlockNode"></a>

### CodeBlockNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| language | [string](#string) |  |  |
| content | [string](#string) |  |  |






<a name="memos-api-v2-CodeNode"></a>

### CodeNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-EscapingCharacterNode"></a>

### EscapingCharacterNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |






<a name="memos-api-v2-HeadingNode"></a>

### HeadingNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| level | [int32](#int32) |  |  |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-HighlightNode"></a>

### HighlightNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-HorizontalRuleNode"></a>

### HorizontalRuleNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |






<a name="memos-api-v2-ImageNode"></a>

### ImageNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| alt_text | [string](#string) |  |  |
| url | [string](#string) |  |  |






<a name="memos-api-v2-ItalicNode"></a>

### ItalicNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |
| content | [string](#string) |  |  |






<a name="memos-api-v2-LineBreakNode"></a>

### LineBreakNode







<a name="memos-api-v2-LinkNode"></a>

### LinkNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| text | [string](#string) |  |  |
| url | [string](#string) |  |  |






<a name="memos-api-v2-MathBlockNode"></a>

### MathBlockNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-MathNode"></a>

### MathNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-Node"></a>

### Node



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| type | [NodeType](#memos-api-v2-NodeType) |  |  |
| line_break_node | [LineBreakNode](#memos-api-v2-LineBreakNode) |  |  |
| paragraph_node | [ParagraphNode](#memos-api-v2-ParagraphNode) |  |  |
| code_block_node | [CodeBlockNode](#memos-api-v2-CodeBlockNode) |  |  |
| heading_node | [HeadingNode](#memos-api-v2-HeadingNode) |  |  |
| horizontal_rule_node | [HorizontalRuleNode](#memos-api-v2-HorizontalRuleNode) |  |  |
| blockquote_node | [BlockquoteNode](#memos-api-v2-BlockquoteNode) |  |  |
| ordered_list_node | [OrderedListNode](#memos-api-v2-OrderedListNode) |  |  |
| unordered_list_node | [UnorderedListNode](#memos-api-v2-UnorderedListNode) |  |  |
| task_list_node | [TaskListNode](#memos-api-v2-TaskListNode) |  |  |
| math_block_node | [MathBlockNode](#memos-api-v2-MathBlockNode) |  |  |
| table_node | [TableNode](#memos-api-v2-TableNode) |  |  |
| text_node | [TextNode](#memos-api-v2-TextNode) |  |  |
| bold_node | [BoldNode](#memos-api-v2-BoldNode) |  |  |
| italic_node | [ItalicNode](#memos-api-v2-ItalicNode) |  |  |
| bold_italic_node | [BoldItalicNode](#memos-api-v2-BoldItalicNode) |  |  |
| code_node | [CodeNode](#memos-api-v2-CodeNode) |  |  |
| image_node | [ImageNode](#memos-api-v2-ImageNode) |  |  |
| link_node | [LinkNode](#memos-api-v2-LinkNode) |  |  |
| auto_link_node | [AutoLinkNode](#memos-api-v2-AutoLinkNode) |  |  |
| tag_node | [TagNode](#memos-api-v2-TagNode) |  |  |
| strikethrough_node | [StrikethroughNode](#memos-api-v2-StrikethroughNode) |  |  |
| escaping_character_node | [EscapingCharacterNode](#memos-api-v2-EscapingCharacterNode) |  |  |
| math_node | [MathNode](#memos-api-v2-MathNode) |  |  |
| highlight_node | [HighlightNode](#memos-api-v2-HighlightNode) |  |  |
| subscript_node | [SubscriptNode](#memos-api-v2-SubscriptNode) |  |  |
| superscript_node | [SuperscriptNode](#memos-api-v2-SuperscriptNode) |  |  |






<a name="memos-api-v2-OrderedListNode"></a>

### OrderedListNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| number | [string](#string) |  |  |
| indent | [int32](#int32) |  |  |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-ParagraphNode"></a>

### ParagraphNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-ParseMarkdownRequest"></a>

### ParseMarkdownRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| markdown | [string](#string) |  |  |






<a name="memos-api-v2-ParseMarkdownResponse"></a>

### ParseMarkdownResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| nodes | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-StrikethroughNode"></a>

### StrikethroughNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-SubscriptNode"></a>

### SubscriptNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-SuperscriptNode"></a>

### SuperscriptNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-TableNode"></a>

### TableNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| header | [string](#string) | repeated |  |
| delimiter | [string](#string) | repeated |  |
| rows | [TableNode.Row](#memos-api-v2-TableNode-Row) | repeated |  |






<a name="memos-api-v2-TableNode-Row"></a>

### TableNode.Row



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| cells | [string](#string) | repeated |  |






<a name="memos-api-v2-TagNode"></a>

### TagNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-TaskListNode"></a>

### TaskListNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |
| indent | [int32](#int32) |  |  |
| complete | [bool](#bool) |  |  |
| children | [Node](#memos-api-v2-Node) | repeated |  |






<a name="memos-api-v2-TextNode"></a>

### TextNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |






<a name="memos-api-v2-UnorderedListNode"></a>

### UnorderedListNode



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| symbol | [string](#string) |  |  |
| indent | [int32](#int32) |  |  |
| children | [Node](#memos-api-v2-Node) | repeated |  |





 


<a name="memos-api-v2-NodeType"></a>

### NodeType


| Name | Number | Description |
| ---- | ------ | ----------- |
| NODE_UNSPECIFIED | 0 |  |
| LINE_BREAK | 1 |  |
| PARAGRAPH | 2 |  |
| CODE_BLOCK | 3 |  |
| HEADING | 4 |  |
| HORIZONTAL_RULE | 5 |  |
| BLOCKQUOTE | 6 |  |
| ORDERED_LIST | 7 |  |
| UNORDERED_LIST | 8 |  |
| TASK_LIST | 9 |  |
| MATH_BLOCK | 10 |  |
| TABLE | 11 |  |
| TEXT | 12 |  |
| BOLD | 13 |  |
| ITALIC | 14 |  |
| BOLD_ITALIC | 15 |  |
| CODE | 16 |  |
| IMAGE | 17 |  |
| LINK | 18 |  |
| AUTO_LINK | 19 |  |
| TAG | 20 |  |
| STRIKETHROUGH | 21 |  |
| ESCAPING_CHARACTER | 22 |  |
| MATH | 23 |  |
| HIGHLIGHT | 24 |  |
| SUBSCRIPT | 25 |  |
| SUPERSCRIPT | 26 |  |


 

 


<a name="memos-api-v2-MarkdownService"></a>

### MarkdownService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ParseMarkdown | [ParseMarkdownRequest](#memos-api-v2-ParseMarkdownRequest) | [ParseMarkdownResponse](#memos-api-v2-ParseMarkdownResponse) |  |

 



<a name="api_v2_memo_relation_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/memo_relation_service.proto



<a name="memos-api-v2-MemoRelation"></a>

### MemoRelation



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo_id | [int32](#int32) |  |  |
| related_memo_id | [int32](#int32) |  |  |
| type | [MemoRelation.Type](#memos-api-v2-MemoRelation-Type) |  |  |





 


<a name="memos-api-v2-MemoRelation-Type"></a>

### MemoRelation.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| REFERENCE | 1 |  |
| COMMENT | 2 |  |


 

 

 



<a name="api_v2_resource_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/resource_service.proto



<a name="memos-api-v2-CreateResourceRequest"></a>

### CreateResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| filename | [string](#string) |  |  |
| external_link | [string](#string) |  |  |
| type | [string](#string) |  |  |
| memo_id | [int32](#int32) | optional |  |






<a name="memos-api-v2-CreateResourceResponse"></a>

### CreateResourceResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |






<a name="memos-api-v2-DeleteResourceRequest"></a>

### DeleteResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-DeleteResourceResponse"></a>

### DeleteResourceResponse







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
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| filename | [string](#string) |  |  |
| external_link | [string](#string) |  |  |
| type | [string](#string) |  |  |
| size | [int64](#int64) |  |  |
| memo_id | [int32](#int32) | optional |  |






<a name="memos-api-v2-UpdateResourceRequest"></a>

### UpdateResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateResourceResponse"></a>

### UpdateResourceResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |





 

 

 


<a name="memos-api-v2-ResourceService"></a>

### ResourceService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| CreateResource | [CreateResourceRequest](#memos-api-v2-CreateResourceRequest) | [CreateResourceResponse](#memos-api-v2-CreateResourceResponse) |  |
| ListResources | [ListResourcesRequest](#memos-api-v2-ListResourcesRequest) | [ListResourcesResponse](#memos-api-v2-ListResourcesResponse) |  |
| UpdateResource | [UpdateResourceRequest](#memos-api-v2-UpdateResourceRequest) | [UpdateResourceResponse](#memos-api-v2-UpdateResourceResponse) |  |
| DeleteResource | [DeleteResourceRequest](#memos-api-v2-DeleteResourceRequest) | [DeleteResourceResponse](#memos-api-v2-DeleteResourceResponse) |  |

 



<a name="api_v2_memo_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/memo_service.proto



<a name="memos-api-v2-CreateMemoCommentRequest"></a>

### CreateMemoCommentRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  | id is the memo id to create comment for. |
| create | [CreateMemoRequest](#memos-api-v2-CreateMemoRequest) |  |  |






<a name="memos-api-v2-CreateMemoCommentResponse"></a>

### CreateMemoCommentResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |






<a name="memos-api-v2-CreateMemoRequest"></a>

### CreateMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [string](#string) |  |  |
| visibility | [Visibility](#memos-api-v2-Visibility) |  |  |






<a name="memos-api-v2-CreateMemoResponse"></a>

### CreateMemoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |






<a name="memos-api-v2-DeleteMemoRequest"></a>

### DeleteMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-DeleteMemoResponse"></a>

### DeleteMemoResponse







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






<a name="memos-api-v2-GetUserMemosStatsRequest"></a>

### GetUserMemosStatsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | name is the name of the user to get stats for. Format: users/{username} |
| timezone | [string](#string) |  | timezone location Format: uses tz identifier https://en.wikipedia.org/wiki/List_of_tz_database_time_zones |
| filter | [string](#string) |  | Same as ListMemosRequest.filter |






<a name="memos-api-v2-GetUserMemosStatsResponse"></a>

### GetUserMemosStatsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| stats | [GetUserMemosStatsResponse.StatsEntry](#memos-api-v2-GetUserMemosStatsResponse-StatsEntry) | repeated | stats is the stats of memo creating/updating activities. key is the year-month-day string. e.g. &#34;2020-01-01&#34;. |






<a name="memos-api-v2-GetUserMemosStatsResponse-StatsEntry"></a>

### GetUserMemosStatsResponse.StatsEntry



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| key | [string](#string) |  |  |
| value | [int32](#int32) |  |  |






<a name="memos-api-v2-ListMemoCommentsRequest"></a>

### ListMemoCommentsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-ListMemoCommentsResponse"></a>

### ListMemoCommentsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memos | [Memo](#memos-api-v2-Memo) | repeated |  |






<a name="memos-api-v2-ListMemoRelationsRequest"></a>

### ListMemoRelationsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-ListMemoRelationsResponse"></a>

### ListMemoRelationsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |






<a name="memos-api-v2-ListMemoResourcesRequest"></a>

### ListMemoResourcesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-ListMemoResourcesResponse"></a>

### ListMemoResourcesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






<a name="memos-api-v2-ListMemosRequest"></a>

### ListMemosRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| offset | [int32](#int32) |  | offset is the offset of the first memo to return. |
| limit | [int32](#int32) |  | limit is the maximum number of memos to return. |
| filter | [string](#string) |  | Filter is used to filter memos returned in the list. Format: &#34;creator == users/{username} &amp;&amp; visibilities == [&#39;PUBLIC&#39;, &#39;PROTECTED&#39;]&#34; |






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
| creator | [string](#string) |  | The name of the creator. Format: users/{username} |
| creator_id | [int32](#int32) |  |  |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| update_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| display_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| content | [string](#string) |  |  |
| nodes | [Node](#memos-api-v2-Node) | repeated |  |
| visibility | [Visibility](#memos-api-v2-Visibility) |  |  |
| pinned | [bool](#bool) |  |  |
| parent_id | [int32](#int32) | optional |  |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |






<a name="memos-api-v2-SetMemoRelationsRequest"></a>

### SetMemoRelationsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |






<a name="memos-api-v2-SetMemoRelationsResponse"></a>

### SetMemoRelationsResponse







<a name="memos-api-v2-SetMemoResourcesRequest"></a>

### SetMemoResourcesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






<a name="memos-api-v2-SetMemoResourcesResponse"></a>

### SetMemoResourcesResponse







<a name="memos-api-v2-UpdateMemoRequest"></a>

### UpdateMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| memo | [Memo](#memos-api-v2-Memo) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateMemoResponse"></a>

### UpdateMemoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |





 


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
| CreateMemo | [CreateMemoRequest](#memos-api-v2-CreateMemoRequest) | [CreateMemoResponse](#memos-api-v2-CreateMemoResponse) | CreateMemo creates a memo. |
| ListMemos | [ListMemosRequest](#memos-api-v2-ListMemosRequest) | [ListMemosResponse](#memos-api-v2-ListMemosResponse) | ListMemos lists memos with pagination and filter. |
| GetMemo | [GetMemoRequest](#memos-api-v2-GetMemoRequest) | [GetMemoResponse](#memos-api-v2-GetMemoResponse) | GetMemo gets a memo by id. |
| UpdateMemo | [UpdateMemoRequest](#memos-api-v2-UpdateMemoRequest) | [UpdateMemoResponse](#memos-api-v2-UpdateMemoResponse) | UpdateMemo updates a memo. |
| DeleteMemo | [DeleteMemoRequest](#memos-api-v2-DeleteMemoRequest) | [DeleteMemoResponse](#memos-api-v2-DeleteMemoResponse) | DeleteMemo deletes a memo by id. |
| SetMemoResources | [SetMemoResourcesRequest](#memos-api-v2-SetMemoResourcesRequest) | [SetMemoResourcesResponse](#memos-api-v2-SetMemoResourcesResponse) | SetMemoResources sets resources for a memo. |
| ListMemoResources | [ListMemoResourcesRequest](#memos-api-v2-ListMemoResourcesRequest) | [ListMemoResourcesResponse](#memos-api-v2-ListMemoResourcesResponse) | ListMemoResources lists resources for a memo. |
| SetMemoRelations | [SetMemoRelationsRequest](#memos-api-v2-SetMemoRelationsRequest) | [SetMemoRelationsResponse](#memos-api-v2-SetMemoRelationsResponse) | SetMemoRelations sets relations for a memo. |
| ListMemoRelations | [ListMemoRelationsRequest](#memos-api-v2-ListMemoRelationsRequest) | [ListMemoRelationsResponse](#memos-api-v2-ListMemoRelationsResponse) | ListMemoRelations lists relations for a memo. |
| CreateMemoComment | [CreateMemoCommentRequest](#memos-api-v2-CreateMemoCommentRequest) | [CreateMemoCommentResponse](#memos-api-v2-CreateMemoCommentResponse) | CreateMemoComment creates a comment for a memo. |
| ListMemoComments | [ListMemoCommentsRequest](#memos-api-v2-ListMemoCommentsRequest) | [ListMemoCommentsResponse](#memos-api-v2-ListMemoCommentsResponse) | ListMemoComments lists comments for a memo. |
| GetUserMemosStats | [GetUserMemosStatsRequest](#memos-api-v2-GetUserMemosStatsRequest) | [GetUserMemosStatsResponse](#memos-api-v2-GetUserMemosStatsResponse) | GetUserMemosStats gets stats of memos for a user. |

 



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
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






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



<a name="memos-api-v2-DeleteTagRequest"></a>

### DeleteTagRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tag | [Tag](#memos-api-v2-Tag) |  |  |






<a name="memos-api-v2-DeleteTagResponse"></a>

### DeleteTagResponse







<a name="memos-api-v2-GetTagSuggestionsRequest"></a>

### GetTagSuggestionsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | The creator of tags. Format: users/{username} |






<a name="memos-api-v2-GetTagSuggestionsResponse"></a>

### GetTagSuggestionsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tags | [string](#string) | repeated |  |






<a name="memos-api-v2-ListTagsRequest"></a>

### ListTagsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | The creator of tags. Format: users/{username} |






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
| creator | [string](#string) |  | The creator of tags. Format: users/{username} |






<a name="memos-api-v2-UpsertTagRequest"></a>

### UpsertTagRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  |  |






<a name="memos-api-v2-UpsertTagResponse"></a>

### UpsertTagResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tag | [Tag](#memos-api-v2-Tag) |  |  |





 

 

 


<a name="memos-api-v2-TagService"></a>

### TagService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| UpsertTag | [UpsertTagRequest](#memos-api-v2-UpsertTagRequest) | [UpsertTagResponse](#memos-api-v2-UpsertTagResponse) |  |
| ListTags | [ListTagsRequest](#memos-api-v2-ListTagsRequest) | [ListTagsResponse](#memos-api-v2-ListTagsResponse) |  |
| DeleteTag | [DeleteTagRequest](#memos-api-v2-DeleteTagRequest) | [DeleteTagResponse](#memos-api-v2-DeleteTagResponse) |  |
| GetTagSuggestions | [GetTagSuggestionsRequest](#memos-api-v2-GetTagSuggestionsRequest) | [GetTagSuggestionsResponse](#memos-api-v2-GetTagSuggestionsResponse) |  |

 



<a name="api_v2_webhook_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/webhook_service.proto



<a name="memos-api-v2-CreateWebhookRequest"></a>

### CreateWebhookRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  |  |
| url | [string](#string) |  |  |






<a name="memos-api-v2-CreateWebhookResponse"></a>

### CreateWebhookResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| webhook | [Webhook](#memos-api-v2-Webhook) |  |  |






<a name="memos-api-v2-DeleteWebhookRequest"></a>

### DeleteWebhookRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-DeleteWebhookResponse"></a>

### DeleteWebhookResponse







<a name="memos-api-v2-GetWebhookRequest"></a>

### GetWebhookRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |






<a name="memos-api-v2-GetWebhookResponse"></a>

### GetWebhookResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| webhook | [Webhook](#memos-api-v2-Webhook) |  |  |






<a name="memos-api-v2-ListWebhooksRequest"></a>

### ListWebhooksRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| creator_id | [int32](#int32) |  |  |






<a name="memos-api-v2-ListWebhooksResponse"></a>

### ListWebhooksResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| webhooks | [Webhook](#memos-api-v2-Webhook) | repeated |  |






<a name="memos-api-v2-UpdateWebhookRequest"></a>

### UpdateWebhookRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| webhook | [Webhook](#memos-api-v2-Webhook) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateWebhookResponse"></a>

### UpdateWebhookResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| webhook | [Webhook](#memos-api-v2-Webhook) |  |  |






<a name="memos-api-v2-Webhook"></a>

### Webhook



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| creator_id | [int32](#int32) |  |  |
| created_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| updated_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| row_status | [RowStatus](#memos-api-v2-RowStatus) |  |  |
| name | [string](#string) |  |  |
| url | [string](#string) |  |  |





 

 

 


<a name="memos-api-v2-WebhookService"></a>

### WebhookService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| CreateWebhook | [CreateWebhookRequest](#memos-api-v2-CreateWebhookRequest) | [CreateWebhookResponse](#memos-api-v2-CreateWebhookResponse) |  |
| GetWebhook | [GetWebhookRequest](#memos-api-v2-GetWebhookRequest) | [GetWebhookResponse](#memos-api-v2-GetWebhookResponse) |  |
| ListWebhooks | [ListWebhooksRequest](#memos-api-v2-ListWebhooksRequest) | [ListWebhooksResponse](#memos-api-v2-ListWebhooksResponse) |  |
| UpdateWebhook | [UpdateWebhookRequest](#memos-api-v2-UpdateWebhookRequest) | [UpdateWebhookResponse](#memos-api-v2-UpdateWebhookResponse) |  |
| DeleteWebhook | [DeleteWebhookRequest](#memos-api-v2-DeleteWebhookRequest) | [DeleteWebhookResponse](#memos-api-v2-DeleteWebhookResponse) |  |

 



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

