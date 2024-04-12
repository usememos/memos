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
    - [PageToken](#memos-api-v2-PageToken)
  
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
    - [SearchUsersRequest](#memos-api-v2-SearchUsersRequest)
    - [SearchUsersResponse](#memos-api-v2-SearchUsersResponse)
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
    - [SignInRequest](#memos-api-v2-SignInRequest)
    - [SignInResponse](#memos-api-v2-SignInResponse)
    - [SignInWithSSORequest](#memos-api-v2-SignInWithSSORequest)
    - [SignInWithSSOResponse](#memos-api-v2-SignInWithSSOResponse)
    - [SignOutRequest](#memos-api-v2-SignOutRequest)
    - [SignOutResponse](#memos-api-v2-SignOutResponse)
    - [SignUpRequest](#memos-api-v2-SignUpRequest)
    - [SignUpResponse](#memos-api-v2-SignUpResponse)
  
    - [AuthService](#memos-api-v2-AuthService)
  
- [api/v2/idp_service.proto](#api_v2_idp_service-proto)
    - [CreateIdentityProviderRequest](#memos-api-v2-CreateIdentityProviderRequest)
    - [CreateIdentityProviderResponse](#memos-api-v2-CreateIdentityProviderResponse)
    - [DeleteIdentityProviderRequest](#memos-api-v2-DeleteIdentityProviderRequest)
    - [DeleteIdentityProviderResponse](#memos-api-v2-DeleteIdentityProviderResponse)
    - [GetIdentityProviderRequest](#memos-api-v2-GetIdentityProviderRequest)
    - [GetIdentityProviderResponse](#memos-api-v2-GetIdentityProviderResponse)
    - [IdentityProvider](#memos-api-v2-IdentityProvider)
    - [IdentityProvider.Config](#memos-api-v2-IdentityProvider-Config)
    - [IdentityProvider.Config.FieldMapping](#memos-api-v2-IdentityProvider-Config-FieldMapping)
    - [IdentityProvider.Config.OAuth2](#memos-api-v2-IdentityProvider-Config-OAuth2)
    - [ListIdentityProvidersRequest](#memos-api-v2-ListIdentityProvidersRequest)
    - [ListIdentityProvidersResponse](#memos-api-v2-ListIdentityProvidersResponse)
    - [UpdateIdentityProviderRequest](#memos-api-v2-UpdateIdentityProviderRequest)
    - [UpdateIdentityProviderResponse](#memos-api-v2-UpdateIdentityProviderResponse)
  
    - [IdentityProvider.Type](#memos-api-v2-IdentityProvider-Type)
  
    - [IdentityProviderService](#memos-api-v2-IdentityProviderService)
  
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
  
- [api/v2/link_service.proto](#api_v2_link_service-proto)
    - [GetLinkMetadataRequest](#memos-api-v2-GetLinkMetadataRequest)
    - [GetLinkMetadataResponse](#memos-api-v2-GetLinkMetadataResponse)
    - [LinkMetadata](#memos-api-v2-LinkMetadata)
  
    - [LinkService](#memos-api-v2-LinkService)
  
- [api/v2/memo_relation_service.proto](#api_v2_memo_relation_service-proto)
    - [MemoRelation](#memos-api-v2-MemoRelation)
  
    - [MemoRelation.Type](#memos-api-v2-MemoRelation-Type)
  
- [api/v2/reaction_service.proto](#api_v2_reaction_service-proto)
    - [Reaction](#memos-api-v2-Reaction)
  
    - [Reaction.Type](#memos-api-v2-Reaction-Type)
  
- [api/v2/resource_service.proto](#api_v2_resource_service-proto)
    - [CreateResourceRequest](#memos-api-v2-CreateResourceRequest)
    - [CreateResourceResponse](#memos-api-v2-CreateResourceResponse)
    - [DeleteResourceRequest](#memos-api-v2-DeleteResourceRequest)
    - [DeleteResourceResponse](#memos-api-v2-DeleteResourceResponse)
    - [GetResourceRequest](#memos-api-v2-GetResourceRequest)
    - [GetResourceResponse](#memos-api-v2-GetResourceResponse)
    - [ListResourcesRequest](#memos-api-v2-ListResourcesRequest)
    - [ListResourcesResponse](#memos-api-v2-ListResourcesResponse)
    - [Resource](#memos-api-v2-Resource)
    - [SearchResourcesRequest](#memos-api-v2-SearchResourcesRequest)
    - [SearchResourcesResponse](#memos-api-v2-SearchResourcesResponse)
    - [UpdateResourceRequest](#memos-api-v2-UpdateResourceRequest)
    - [UpdateResourceResponse](#memos-api-v2-UpdateResourceResponse)
  
    - [ResourceService](#memos-api-v2-ResourceService)
  
- [api/v2/memo_service.proto](#api_v2_memo_service-proto)
    - [CreateMemoCommentRequest](#memos-api-v2-CreateMemoCommentRequest)
    - [CreateMemoCommentResponse](#memos-api-v2-CreateMemoCommentResponse)
    - [CreateMemoRequest](#memos-api-v2-CreateMemoRequest)
    - [CreateMemoResponse](#memos-api-v2-CreateMemoResponse)
    - [DeleteMemoReactionRequest](#memos-api-v2-DeleteMemoReactionRequest)
    - [DeleteMemoReactionResponse](#memos-api-v2-DeleteMemoReactionResponse)
    - [DeleteMemoRequest](#memos-api-v2-DeleteMemoRequest)
    - [DeleteMemoResponse](#memos-api-v2-DeleteMemoResponse)
    - [ExportMemosRequest](#memos-api-v2-ExportMemosRequest)
    - [ExportMemosResponse](#memos-api-v2-ExportMemosResponse)
    - [GetMemoRequest](#memos-api-v2-GetMemoRequest)
    - [GetMemoResponse](#memos-api-v2-GetMemoResponse)
    - [GetUserMemosStatsRequest](#memos-api-v2-GetUserMemosStatsRequest)
    - [GetUserMemosStatsResponse](#memos-api-v2-GetUserMemosStatsResponse)
    - [GetUserMemosStatsResponse.StatsEntry](#memos-api-v2-GetUserMemosStatsResponse-StatsEntry)
    - [ListMemoCommentsRequest](#memos-api-v2-ListMemoCommentsRequest)
    - [ListMemoCommentsResponse](#memos-api-v2-ListMemoCommentsResponse)
    - [ListMemoReactionsRequest](#memos-api-v2-ListMemoReactionsRequest)
    - [ListMemoReactionsResponse](#memos-api-v2-ListMemoReactionsResponse)
    - [ListMemoRelationsRequest](#memos-api-v2-ListMemoRelationsRequest)
    - [ListMemoRelationsResponse](#memos-api-v2-ListMemoRelationsResponse)
    - [ListMemoResourcesRequest](#memos-api-v2-ListMemoResourcesRequest)
    - [ListMemoResourcesResponse](#memos-api-v2-ListMemoResourcesResponse)
    - [ListMemosRequest](#memos-api-v2-ListMemosRequest)
    - [ListMemosResponse](#memos-api-v2-ListMemosResponse)
    - [Memo](#memos-api-v2-Memo)
    - [SearchMemosRequest](#memos-api-v2-SearchMemosRequest)
    - [SearchMemosResponse](#memos-api-v2-SearchMemosResponse)
    - [SetMemoRelationsRequest](#memos-api-v2-SetMemoRelationsRequest)
    - [SetMemoRelationsResponse](#memos-api-v2-SetMemoRelationsResponse)
    - [SetMemoResourcesRequest](#memos-api-v2-SetMemoResourcesRequest)
    - [SetMemoResourcesResponse](#memos-api-v2-SetMemoResourcesResponse)
    - [UpdateMemoRequest](#memos-api-v2-UpdateMemoRequest)
    - [UpdateMemoResponse](#memos-api-v2-UpdateMemoResponse)
    - [UpsertMemoReactionRequest](#memos-api-v2-UpsertMemoReactionRequest)
    - [UpsertMemoReactionResponse](#memos-api-v2-UpsertMemoReactionResponse)
  
    - [Visibility](#memos-api-v2-Visibility)
  
    - [MemoService](#memos-api-v2-MemoService)
  
- [api/v2/tag_service.proto](#api_v2_tag_service-proto)
    - [BatchUpsertTagRequest](#memos-api-v2-BatchUpsertTagRequest)
    - [BatchUpsertTagResponse](#memos-api-v2-BatchUpsertTagResponse)
    - [DeleteTagRequest](#memos-api-v2-DeleteTagRequest)
    - [DeleteTagResponse](#memos-api-v2-DeleteTagResponse)
    - [GetTagSuggestionsRequest](#memos-api-v2-GetTagSuggestionsRequest)
    - [GetTagSuggestionsResponse](#memos-api-v2-GetTagSuggestionsResponse)
    - [ListTagsRequest](#memos-api-v2-ListTagsRequest)
    - [ListTagsResponse](#memos-api-v2-ListTagsResponse)
    - [RenameTagRequest](#memos-api-v2-RenameTagRequest)
    - [RenameTagResponse](#memos-api-v2-RenameTagResponse)
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
  
- [api/v2/workspace_service.proto](#api_v2_workspace_service-proto)
    - [GetWorkspaceProfileRequest](#memos-api-v2-GetWorkspaceProfileRequest)
    - [GetWorkspaceProfileResponse](#memos-api-v2-GetWorkspaceProfileResponse)
    - [WorkspaceProfile](#memos-api-v2-WorkspaceProfile)
  
    - [WorkspaceService](#memos-api-v2-WorkspaceService)
  
- [api/v2/workspace_setting_service.proto](#api_v2_workspace_setting_service-proto)
    - [GetWorkspaceSettingRequest](#memos-api-v2-GetWorkspaceSettingRequest)
    - [GetWorkspaceSettingResponse](#memos-api-v2-GetWorkspaceSettingResponse)
    - [ListWorkspaceSettingsRequest](#memos-api-v2-ListWorkspaceSettingsRequest)
    - [ListWorkspaceSettingsResponse](#memos-api-v2-ListWorkspaceSettingsResponse)
    - [SetWorkspaceSettingRequest](#memos-api-v2-SetWorkspaceSettingRequest)
    - [SetWorkspaceSettingResponse](#memos-api-v2-SetWorkspaceSettingResponse)
    - [WorkspaceCustomProfile](#memos-api-v2-WorkspaceCustomProfile)
    - [WorkspaceGeneralSetting](#memos-api-v2-WorkspaceGeneralSetting)
    - [WorkspaceMemoRelatedSetting](#memos-api-v2-WorkspaceMemoRelatedSetting)
    - [WorkspaceSetting](#memos-api-v2-WorkspaceSetting)
    - [WorkspaceStorageSetting](#memos-api-v2-WorkspaceStorageSetting)
    - [WorkspaceTelegramIntegrationSetting](#memos-api-v2-WorkspaceTelegramIntegrationSetting)
  
    - [WorkspaceStorageSetting.StorageType](#memos-api-v2-WorkspaceStorageSetting-StorageType)
  
    - [WorkspaceSettingService](#memos-api-v2-WorkspaceSettingService)
  
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
| GetActivity | [GetActivityRequest](#memos-api-v2-GetActivityRequest) | [GetActivityResponse](#memos-api-v2-GetActivityResponse) | GetActivity returns the activity with the given id. |

 



<a name="api_v2_common-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/common.proto



<a name="memos-api-v2-PageToken"></a>

### PageToken
Used internally for obfuscating the page token.


| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| limit | [int32](#int32) |  |  |
| offset | [int32](#int32) |  |  |





 


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
| name | [string](#string) |  | The name of the user. Format: users/{id} |
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
| name | [string](#string) |  | The name of the user. Format: users/{id} |
| access_token | [string](#string) |  | access_token is the access token to delete. |






<a name="memos-api-v2-DeleteUserAccessTokenResponse"></a>

### DeleteUserAccessTokenResponse







<a name="memos-api-v2-DeleteUserRequest"></a>

### DeleteUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{id} |






<a name="memos-api-v2-DeleteUserResponse"></a>

### DeleteUserResponse







<a name="memos-api-v2-GetUserRequest"></a>

### GetUserRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{id} |






<a name="memos-api-v2-GetUserResponse"></a>

### GetUserResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-GetUserSettingRequest"></a>

### GetUserSettingRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{id} |






<a name="memos-api-v2-GetUserSettingResponse"></a>

### GetUserSettingResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [UserSetting](#memos-api-v2-UserSetting) |  |  |






<a name="memos-api-v2-ListUserAccessTokensRequest"></a>

### ListUserAccessTokensRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the user. Format: users/{id} |






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






<a name="memos-api-v2-SearchUsersRequest"></a>

### SearchUsersRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| filter | [string](#string) |  | Filter is used to filter users returned in the list. Format: &#34;username == frank&#34; |






<a name="memos-api-v2-SearchUsersResponse"></a>

### SearchUsersResponse



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
| name | [string](#string) |  | The name of the user. Format: users/{id} |
| id | [int32](#int32) |  | The system generated uid of the user. |
| role | [User.Role](#memos-api-v2-User-Role) |  |  |
| username | [string](#string) |  |  |
| email | [string](#string) |  |  |
| nickname | [string](#string) |  |  |
| avatar_url | [string](#string) |  |  |
| description | [string](#string) |  |  |
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
| name | [string](#string) |  | The name of the user. Format: users/{id} |
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
| SearchUsers | [SearchUsersRequest](#memos-api-v2-SearchUsersRequest) | [SearchUsersResponse](#memos-api-v2-SearchUsersResponse) | SearchUsers searches users by filter. |
| GetUser | [GetUserRequest](#memos-api-v2-GetUserRequest) | [GetUserResponse](#memos-api-v2-GetUserResponse) | GetUser gets a user by name. |
| CreateUser | [CreateUserRequest](#memos-api-v2-CreateUserRequest) | [CreateUserResponse](#memos-api-v2-CreateUserResponse) | CreateUser creates a new user. |
| UpdateUser | [UpdateUserRequest](#memos-api-v2-UpdateUserRequest) | [UpdateUserResponse](#memos-api-v2-UpdateUserResponse) | UpdateUser updates a user. |
| DeleteUser | [DeleteUserRequest](#memos-api-v2-DeleteUserRequest) | [DeleteUserResponse](#memos-api-v2-DeleteUserResponse) | DeleteUser deletes a user. |
| GetUserSetting | [GetUserSettingRequest](#memos-api-v2-GetUserSettingRequest) | [GetUserSettingResponse](#memos-api-v2-GetUserSettingResponse) | GetUserSetting gets the setting of a user. |
| UpdateUserSetting | [UpdateUserSettingRequest](#memos-api-v2-UpdateUserSettingRequest) | [UpdateUserSettingResponse](#memos-api-v2-UpdateUserSettingResponse) | UpdateUserSetting updates the setting of a user. |
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






<a name="memos-api-v2-SignInRequest"></a>

### SignInRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |
| password | [string](#string) |  |  |
| never_expire | [bool](#bool) |  |  |






<a name="memos-api-v2-SignInResponse"></a>

### SignInResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-SignInWithSSORequest"></a>

### SignInWithSSORequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| idp_id | [int32](#int32) |  |  |
| code | [string](#string) |  |  |
| redirect_uri | [string](#string) |  |  |






<a name="memos-api-v2-SignInWithSSOResponse"></a>

### SignInWithSSOResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |






<a name="memos-api-v2-SignOutRequest"></a>

### SignOutRequest







<a name="memos-api-v2-SignOutResponse"></a>

### SignOutResponse







<a name="memos-api-v2-SignUpRequest"></a>

### SignUpRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| username | [string](#string) |  |  |
| password | [string](#string) |  |  |






<a name="memos-api-v2-SignUpResponse"></a>

### SignUpResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [User](#memos-api-v2-User) |  |  |





 

 

 


<a name="memos-api-v2-AuthService"></a>

### AuthService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetAuthStatus | [GetAuthStatusRequest](#memos-api-v2-GetAuthStatusRequest) | [GetAuthStatusResponse](#memos-api-v2-GetAuthStatusResponse) | GetAuthStatus returns the current auth status of the user. |
| SignIn | [SignInRequest](#memos-api-v2-SignInRequest) | [SignInResponse](#memos-api-v2-SignInResponse) | SignIn signs in the user with the given username and password. |
| SignInWithSSO | [SignInWithSSORequest](#memos-api-v2-SignInWithSSORequest) | [SignInWithSSOResponse](#memos-api-v2-SignInWithSSOResponse) | SignInWithSSO signs in the user with the given SSO code. |
| SignUp | [SignUpRequest](#memos-api-v2-SignUpRequest) | [SignUpResponse](#memos-api-v2-SignUpResponse) | SignUp signs up the user with the given username and password. |
| SignOut | [SignOutRequest](#memos-api-v2-SignOutRequest) | [SignOutResponse](#memos-api-v2-SignOutResponse) | SignOut signs out the user. |

 



<a name="api_v2_idp_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/idp_service.proto



<a name="memos-api-v2-CreateIdentityProviderRequest"></a>

### CreateIdentityProviderRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_provider | [IdentityProvider](#memos-api-v2-IdentityProvider) |  | The identityProvider to create. |






<a name="memos-api-v2-CreateIdentityProviderResponse"></a>

### CreateIdentityProviderResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_provider | [IdentityProvider](#memos-api-v2-IdentityProvider) |  | The created identityProvider. |






<a name="memos-api-v2-DeleteIdentityProviderRequest"></a>

### DeleteIdentityProviderRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the identityProvider to delete. Format: identityProviders/{id} |






<a name="memos-api-v2-DeleteIdentityProviderResponse"></a>

### DeleteIdentityProviderResponse







<a name="memos-api-v2-GetIdentityProviderRequest"></a>

### GetIdentityProviderRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the identityProvider to get. Format: identityProviders/{id} |






<a name="memos-api-v2-GetIdentityProviderResponse"></a>

### GetIdentityProviderResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_provider | [IdentityProvider](#memos-api-v2-IdentityProvider) |  | The identityProvider. |






<a name="memos-api-v2-IdentityProvider"></a>

### IdentityProvider



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the identityProvider. Format: identityProviders/{id} |
| type | [IdentityProvider.Type](#memos-api-v2-IdentityProvider-Type) |  |  |
| title | [string](#string) |  |  |
| identifier_filter | [string](#string) |  |  |
| config | [IdentityProvider.Config](#memos-api-v2-IdentityProvider-Config) |  |  |






<a name="memos-api-v2-IdentityProvider-Config"></a>

### IdentityProvider.Config



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| oauth2 | [IdentityProvider.Config.OAuth2](#memos-api-v2-IdentityProvider-Config-OAuth2) |  |  |






<a name="memos-api-v2-IdentityProvider-Config-FieldMapping"></a>

### IdentityProvider.Config.FieldMapping



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identifier | [string](#string) |  |  |
| display_name | [string](#string) |  |  |
| email | [string](#string) |  |  |






<a name="memos-api-v2-IdentityProvider-Config-OAuth2"></a>

### IdentityProvider.Config.OAuth2



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| client_id | [string](#string) |  |  |
| client_secret | [string](#string) |  |  |
| auth_url | [string](#string) |  |  |
| token_url | [string](#string) |  |  |
| user_info_url | [string](#string) |  |  |
| scopes | [string](#string) | repeated |  |
| field_mapping | [IdentityProvider.Config.FieldMapping](#memos-api-v2-IdentityProvider-Config-FieldMapping) |  |  |






<a name="memos-api-v2-ListIdentityProvidersRequest"></a>

### ListIdentityProvidersRequest







<a name="memos-api-v2-ListIdentityProvidersResponse"></a>

### ListIdentityProvidersResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_providers | [IdentityProvider](#memos-api-v2-IdentityProvider) | repeated |  |






<a name="memos-api-v2-UpdateIdentityProviderRequest"></a>

### UpdateIdentityProviderRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_provider | [IdentityProvider](#memos-api-v2-IdentityProvider) |  | The identityProvider to update. |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  | The update mask applies to the resource. Only the top level fields of IdentityProvider are supported. |






<a name="memos-api-v2-UpdateIdentityProviderResponse"></a>

### UpdateIdentityProviderResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| identity_provider | [IdentityProvider](#memos-api-v2-IdentityProvider) |  | The updated identityProvider. |





 


<a name="memos-api-v2-IdentityProvider-Type"></a>

### IdentityProvider.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| OAUTH2 | 1 |  |


 

 


<a name="memos-api-v2-IdentityProviderService"></a>

### IdentityProviderService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListIdentityProviders | [ListIdentityProvidersRequest](#memos-api-v2-ListIdentityProvidersRequest) | [ListIdentityProvidersResponse](#memos-api-v2-ListIdentityProvidersResponse) |  |
| GetIdentityProvider | [GetIdentityProviderRequest](#memos-api-v2-GetIdentityProviderRequest) | [GetIdentityProviderResponse](#memos-api-v2-GetIdentityProviderResponse) |  |
| CreateIdentityProvider | [CreateIdentityProviderRequest](#memos-api-v2-CreateIdentityProviderRequest) | [CreateIdentityProviderResponse](#memos-api-v2-CreateIdentityProviderResponse) |  |
| UpdateIdentityProvider | [UpdateIdentityProviderRequest](#memos-api-v2-UpdateIdentityProviderRequest) | [UpdateIdentityProviderResponse](#memos-api-v2-UpdateIdentityProviderResponse) | UpdateIdentityProvider updates an identity provider. |
| DeleteIdentityProvider | [DeleteIdentityProviderRequest](#memos-api-v2-DeleteIdentityProviderRequest) | [DeleteIdentityProviderResponse](#memos-api-v2-DeleteIdentityProviderResponse) | DeleteIdentityProvider deletes an identity provider. |

 



<a name="api_v2_inbox_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/inbox_service.proto



<a name="memos-api-v2-DeleteInboxRequest"></a>

### DeleteInboxRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the inbox to delete. Format: inboxes/{id} |






<a name="memos-api-v2-DeleteInboxResponse"></a>

### DeleteInboxResponse







<a name="memos-api-v2-Inbox"></a>

### Inbox



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the inbox. Format: inboxes/{id} |
| sender | [string](#string) |  | Format: users/{id} |
| receiver | [string](#string) |  | Format: users/{id} |
| status | [Inbox.Status](#memos-api-v2-Inbox-Status) |  |  |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| type | [Inbox.Type](#memos-api-v2-Inbox-Type) |  |  |
| activity_id | [int32](#int32) | optional |  |






<a name="memos-api-v2-ListInboxesRequest"></a>

### ListInboxesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | Format: users/{id} |






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
| ListInboxes | [ListInboxesRequest](#memos-api-v2-ListInboxesRequest) | [ListInboxesResponse](#memos-api-v2-ListInboxesResponse) | ListInboxes lists inboxes for a user. |
| UpdateInbox | [UpdateInboxRequest](#memos-api-v2-UpdateInboxRequest) | [UpdateInboxResponse](#memos-api-v2-UpdateInboxResponse) | UpdateInbox updates an inbox. |
| DeleteInbox | [DeleteInboxRequest](#memos-api-v2-DeleteInboxRequest) | [DeleteInboxResponse](#memos-api-v2-DeleteInboxResponse) | DeleteInbox deletes an inbox. |

 



<a name="api_v2_link_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/link_service.proto



<a name="memos-api-v2-GetLinkMetadataRequest"></a>

### GetLinkMetadataRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| link | [string](#string) |  |  |






<a name="memos-api-v2-GetLinkMetadataResponse"></a>

### GetLinkMetadataResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| link_metadata | [LinkMetadata](#memos-api-v2-LinkMetadata) |  |  |






<a name="memos-api-v2-LinkMetadata"></a>

### LinkMetadata



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| title | [string](#string) |  |  |
| description | [string](#string) |  |  |
| image | [string](#string) |  |  |





 

 

 


<a name="memos-api-v2-LinkService"></a>

### LinkService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetLinkMetadata | [GetLinkMetadataRequest](#memos-api-v2-GetLinkMetadataRequest) | [GetLinkMetadataResponse](#memos-api-v2-GetLinkMetadataResponse) |  |

 



<a name="api_v2_memo_relation_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/memo_relation_service.proto



<a name="memos-api-v2-MemoRelation"></a>

### MemoRelation



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [string](#string) |  | The name of memo. Format: &#34;memos/{uid}&#34; |
| related_memo | [string](#string) |  | The name of related memo. Format: &#34;memos/{uid}&#34; |
| type | [MemoRelation.Type](#memos-api-v2-MemoRelation-Type) |  |  |





 


<a name="memos-api-v2-MemoRelation-Type"></a>

### MemoRelation.Type


| Name | Number | Description |
| ---- | ------ | ----------- |
| TYPE_UNSPECIFIED | 0 |  |
| REFERENCE | 1 |  |
| COMMENT | 2 |  |


 

 

 



<a name="api_v2_reaction_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/reaction_service.proto



<a name="memos-api-v2-Reaction"></a>

### Reaction



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| id | [int32](#int32) |  |  |
| creator | [string](#string) |  | The name of the creator. Format: users/{id} |
| content_id | [string](#string) |  |  |
| reaction_type | [Reaction.Type](#memos-api-v2-Reaction-Type) |  |  |





 


<a name="memos-api-v2-Reaction-Type"></a>

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


 

 

 



<a name="api_v2_resource_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/resource_service.proto



<a name="memos-api-v2-CreateResourceRequest"></a>

### CreateResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |






<a name="memos-api-v2-CreateResourceResponse"></a>

### CreateResourceResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |






<a name="memos-api-v2-DeleteResourceRequest"></a>

### DeleteResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the resource. Format: resources/{id} id is the system generated unique identifier. |






<a name="memos-api-v2-DeleteResourceResponse"></a>

### DeleteResourceResponse







<a name="memos-api-v2-GetResourceRequest"></a>

### GetResourceRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the resource. Format: resources/{id} id is the system generated unique identifier. |






<a name="memos-api-v2-GetResourceResponse"></a>

### GetResourceResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resource | [Resource](#memos-api-v2-Resource) |  |  |






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
| name | [string](#string) |  | The name of the resource. Format: resources/{id} id is the system generated unique identifier. |
| uid | [string](#string) |  | The user defined id of the resource. |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| filename | [string](#string) |  |  |
| content | [bytes](#bytes) |  |  |
| external_link | [string](#string) |  |  |
| type | [string](#string) |  |  |
| size | [int64](#int64) |  |  |
| memo | [string](#string) | optional | The related memo. Format: memos/{id} |






<a name="memos-api-v2-SearchResourcesRequest"></a>

### SearchResourcesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| filter | [string](#string) |  |  |






<a name="memos-api-v2-SearchResourcesResponse"></a>

### SearchResourcesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






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
| CreateResource | [CreateResourceRequest](#memos-api-v2-CreateResourceRequest) | [CreateResourceResponse](#memos-api-v2-CreateResourceResponse) | CreateResource creates a new resource. |
| ListResources | [ListResourcesRequest](#memos-api-v2-ListResourcesRequest) | [ListResourcesResponse](#memos-api-v2-ListResourcesResponse) | ListResources lists all resources. |
| SearchResources | [SearchResourcesRequest](#memos-api-v2-SearchResourcesRequest) | [SearchResourcesResponse](#memos-api-v2-SearchResourcesResponse) | SearchResources searches memos. |
| GetResource | [GetResourceRequest](#memos-api-v2-GetResourceRequest) | [GetResourceResponse](#memos-api-v2-GetResourceResponse) | GetResource returns a resource by name. |
| UpdateResource | [UpdateResourceRequest](#memos-api-v2-UpdateResourceRequest) | [UpdateResourceResponse](#memos-api-v2-UpdateResourceResponse) | UpdateResource updates a resource. |
| DeleteResource | [DeleteResourceRequest](#memos-api-v2-DeleteResourceRequest) | [DeleteResourceResponse](#memos-api-v2-DeleteResourceResponse) | DeleteResource deletes a resource by name. |

 



<a name="api_v2_memo_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/memo_service.proto



<a name="memos-api-v2-CreateMemoCommentRequest"></a>

### CreateMemoCommentRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |
| comment | [CreateMemoRequest](#memos-api-v2-CreateMemoRequest) |  |  |






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






<a name="memos-api-v2-DeleteMemoReactionRequest"></a>

### DeleteMemoReactionRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| reaction_id | [int32](#int32) |  |  |






<a name="memos-api-v2-DeleteMemoReactionResponse"></a>

### DeleteMemoReactionResponse







<a name="memos-api-v2-DeleteMemoRequest"></a>

### DeleteMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-DeleteMemoResponse"></a>

### DeleteMemoResponse







<a name="memos-api-v2-ExportMemosRequest"></a>

### ExportMemosRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| filter | [string](#string) |  | Same as ListMemosRequest.filter |






<a name="memos-api-v2-ExportMemosResponse"></a>

### ExportMemosResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| content | [bytes](#bytes) |  |  |






<a name="memos-api-v2-GetMemoRequest"></a>

### GetMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-GetMemoResponse"></a>

### GetMemoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |






<a name="memos-api-v2-GetUserMemosStatsRequest"></a>

### GetUserMemosStatsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | name is the name of the user to get stats for. Format: users/{id} |
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
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-ListMemoCommentsResponse"></a>

### ListMemoCommentsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memos | [Memo](#memos-api-v2-Memo) | repeated |  |






<a name="memos-api-v2-ListMemoReactionsRequest"></a>

### ListMemoReactionsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-ListMemoReactionsResponse"></a>

### ListMemoReactionsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| reactions | [Reaction](#memos-api-v2-Reaction) | repeated |  |






<a name="memos-api-v2-ListMemoRelationsRequest"></a>

### ListMemoRelationsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-ListMemoRelationsResponse"></a>

### ListMemoRelationsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |






<a name="memos-api-v2-ListMemoResourcesRequest"></a>

### ListMemoResourcesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |






<a name="memos-api-v2-ListMemoResourcesResponse"></a>

### ListMemoResourcesResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






<a name="memos-api-v2-ListMemosRequest"></a>

### ListMemosRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| page_size | [int32](#int32) |  | The maximum number of memos to return. |
| page_token | [string](#string) |  | A page token, received from a previous `ListMemos` call. Provide this to retrieve the subsequent page. |
| filter | [string](#string) |  | Filter is used to filter memos returned in the list. Format: &#34;creator == users/{uid} &amp;&amp; visibilities == [&#39;PUBLIC&#39;, &#39;PROTECTED&#39;]&#34; |






<a name="memos-api-v2-ListMemosResponse"></a>

### ListMemosResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memos | [Memo](#memos-api-v2-Memo) | repeated |  |
| next_page_token | [string](#string) |  | A token, which can be sent as `page_token` to retrieve the next page. If this field is omitted, there are no subsequent pages. |






<a name="memos-api-v2-Memo"></a>

### Memo



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} id is the system generated id. |
| uid | [string](#string) |  | The user defined id of the memo. |
| row_status | [RowStatus](#memos-api-v2-RowStatus) |  |  |
| creator | [string](#string) |  | The name of the creator. Format: users/{id} |
| create_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| update_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| display_time | [google.protobuf.Timestamp](#google-protobuf-Timestamp) |  |  |
| content | [string](#string) |  |  |
| visibility | [Visibility](#memos-api-v2-Visibility) |  |  |
| pinned | [bool](#bool) |  |  |
| parent_id | [int32](#int32) | optional |  |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |
| reactions | [Reaction](#memos-api-v2-Reaction) | repeated |  |






<a name="memos-api-v2-SearchMemosRequest"></a>

### SearchMemosRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| filter | [string](#string) |  | Filter is used to filter memos returned. Format: &#34;creator == users/{uid} &amp;&amp; visibilities == [&#39;PUBLIC&#39;, &#39;PROTECTED&#39;]&#34; |






<a name="memos-api-v2-SearchMemosResponse"></a>

### SearchMemosResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memos | [Memo](#memos-api-v2-Memo) | repeated |  |






<a name="memos-api-v2-SetMemoRelationsRequest"></a>

### SetMemoRelationsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |
| relations | [MemoRelation](#memos-api-v2-MemoRelation) | repeated |  |






<a name="memos-api-v2-SetMemoRelationsResponse"></a>

### SetMemoRelationsResponse







<a name="memos-api-v2-SetMemoResourcesRequest"></a>

### SetMemoResourcesRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |
| resources | [Resource](#memos-api-v2-Resource) | repeated |  |






<a name="memos-api-v2-SetMemoResourcesResponse"></a>

### SetMemoResourcesResponse







<a name="memos-api-v2-UpdateMemoRequest"></a>

### UpdateMemoRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |
| update_mask | [google.protobuf.FieldMask](#google-protobuf-FieldMask) |  |  |






<a name="memos-api-v2-UpdateMemoResponse"></a>

### UpdateMemoResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| memo | [Memo](#memos-api-v2-Memo) |  |  |






<a name="memos-api-v2-UpsertMemoReactionRequest"></a>

### UpsertMemoReactionRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The name of the memo. Format: memos/{id} |
| reaction | [Reaction](#memos-api-v2-Reaction) |  |  |






<a name="memos-api-v2-UpsertMemoReactionResponse"></a>

### UpsertMemoReactionResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| reaction | [Reaction](#memos-api-v2-Reaction) |  |  |





 


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
| SearchMemos | [SearchMemosRequest](#memos-api-v2-SearchMemosRequest) | [SearchMemosResponse](#memos-api-v2-SearchMemosResponse) | SearchMemos searches memos. |
| GetMemo | [GetMemoRequest](#memos-api-v2-GetMemoRequest) | [GetMemoResponse](#memos-api-v2-GetMemoResponse) | GetMemo gets a memo. |
| UpdateMemo | [UpdateMemoRequest](#memos-api-v2-UpdateMemoRequest) | [UpdateMemoResponse](#memos-api-v2-UpdateMemoResponse) | UpdateMemo updates a memo. |
| DeleteMemo | [DeleteMemoRequest](#memos-api-v2-DeleteMemoRequest) | [DeleteMemoResponse](#memos-api-v2-DeleteMemoResponse) | DeleteMemo deletes a memo. |
| ExportMemos | [ExportMemosRequest](#memos-api-v2-ExportMemosRequest) | [ExportMemosResponse](#memos-api-v2-ExportMemosResponse) | ExportMemos exports memos. |
| SetMemoResources | [SetMemoResourcesRequest](#memos-api-v2-SetMemoResourcesRequest) | [SetMemoResourcesResponse](#memos-api-v2-SetMemoResourcesResponse) | SetMemoResources sets resources for a memo. |
| ListMemoResources | [ListMemoResourcesRequest](#memos-api-v2-ListMemoResourcesRequest) | [ListMemoResourcesResponse](#memos-api-v2-ListMemoResourcesResponse) | ListMemoResources lists resources for a memo. |
| SetMemoRelations | [SetMemoRelationsRequest](#memos-api-v2-SetMemoRelationsRequest) | [SetMemoRelationsResponse](#memos-api-v2-SetMemoRelationsResponse) | SetMemoRelations sets relations for a memo. |
| ListMemoRelations | [ListMemoRelationsRequest](#memos-api-v2-ListMemoRelationsRequest) | [ListMemoRelationsResponse](#memos-api-v2-ListMemoRelationsResponse) | ListMemoRelations lists relations for a memo. |
| CreateMemoComment | [CreateMemoCommentRequest](#memos-api-v2-CreateMemoCommentRequest) | [CreateMemoCommentResponse](#memos-api-v2-CreateMemoCommentResponse) | CreateMemoComment creates a comment for a memo. |
| ListMemoComments | [ListMemoCommentsRequest](#memos-api-v2-ListMemoCommentsRequest) | [ListMemoCommentsResponse](#memos-api-v2-ListMemoCommentsResponse) | ListMemoComments lists comments for a memo. |
| GetUserMemosStats | [GetUserMemosStatsRequest](#memos-api-v2-GetUserMemosStatsRequest) | [GetUserMemosStatsResponse](#memos-api-v2-GetUserMemosStatsResponse) | GetUserMemosStats gets stats of memos for a user. |
| ListMemoReactions | [ListMemoReactionsRequest](#memos-api-v2-ListMemoReactionsRequest) | [ListMemoReactionsResponse](#memos-api-v2-ListMemoReactionsResponse) | ListMemoReactions lists reactions for a memo. |
| UpsertMemoReaction | [UpsertMemoReactionRequest](#memos-api-v2-UpsertMemoReactionRequest) | [UpsertMemoReactionResponse](#memos-api-v2-UpsertMemoReactionResponse) | UpsertMemoReaction upserts a reaction for a memo. |
| DeleteMemoReaction | [DeleteMemoReactionRequest](#memos-api-v2-DeleteMemoReactionRequest) | [DeleteMemoReactionResponse](#memos-api-v2-DeleteMemoReactionResponse) | DeleteMemoReaction deletes a reaction for a memo. |

 



<a name="api_v2_tag_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/tag_service.proto



<a name="memos-api-v2-BatchUpsertTagRequest"></a>

### BatchUpsertTagRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| requests | [UpsertTagRequest](#memos-api-v2-UpsertTagRequest) | repeated |  |






<a name="memos-api-v2-BatchUpsertTagResponse"></a>

### BatchUpsertTagResponse







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
| user | [string](#string) |  | The creator of tags. Format: users/{id} |






<a name="memos-api-v2-GetTagSuggestionsResponse"></a>

### GetTagSuggestionsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tags | [string](#string) | repeated |  |






<a name="memos-api-v2-ListTagsRequest"></a>

### ListTagsRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | The creator of tags. Format: users/{id} |






<a name="memos-api-v2-ListTagsResponse"></a>

### ListTagsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tags | [Tag](#memos-api-v2-Tag) | repeated |  |






<a name="memos-api-v2-RenameTagRequest"></a>

### RenameTagRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| user | [string](#string) |  | The creator of tags. Format: users/{id} |
| old_name | [string](#string) |  |  |
| new_name | [string](#string) |  |  |






<a name="memos-api-v2-RenameTagResponse"></a>

### RenameTagResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| tag | [Tag](#memos-api-v2-Tag) |  |  |






<a name="memos-api-v2-Tag"></a>

### Tag



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  |  |
| creator | [string](#string) |  | The creator of tags. Format: users/{id} |






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
| UpsertTag | [UpsertTagRequest](#memos-api-v2-UpsertTagRequest) | [UpsertTagResponse](#memos-api-v2-UpsertTagResponse) | UpsertTag upserts a tag. |
| BatchUpsertTag | [BatchUpsertTagRequest](#memos-api-v2-BatchUpsertTagRequest) | [BatchUpsertTagResponse](#memos-api-v2-BatchUpsertTagResponse) | BatchUpsertTag upserts multiple tags. |
| ListTags | [ListTagsRequest](#memos-api-v2-ListTagsRequest) | [ListTagsResponse](#memos-api-v2-ListTagsResponse) | ListTags lists tags. |
| RenameTag | [RenameTagRequest](#memos-api-v2-RenameTagRequest) | [RenameTagResponse](#memos-api-v2-RenameTagResponse) | RenameTag renames a tag. All related memos will be updated. |
| DeleteTag | [DeleteTagRequest](#memos-api-v2-DeleteTagRequest) | [DeleteTagResponse](#memos-api-v2-DeleteTagResponse) | DeleteTag deletes a tag. |
| GetTagSuggestions | [GetTagSuggestionsRequest](#memos-api-v2-GetTagSuggestionsRequest) | [GetTagSuggestionsResponse](#memos-api-v2-GetTagSuggestionsResponse) | GetTagSuggestions gets tag suggestions from the user&#39;s memos. |

 



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
| CreateWebhook | [CreateWebhookRequest](#memos-api-v2-CreateWebhookRequest) | [CreateWebhookResponse](#memos-api-v2-CreateWebhookResponse) | CreateWebhook creates a new webhook. |
| GetWebhook | [GetWebhookRequest](#memos-api-v2-GetWebhookRequest) | [GetWebhookResponse](#memos-api-v2-GetWebhookResponse) | GetWebhook returns a webhook by id. |
| ListWebhooks | [ListWebhooksRequest](#memos-api-v2-ListWebhooksRequest) | [ListWebhooksResponse](#memos-api-v2-ListWebhooksResponse) | ListWebhooks returns a list of webhooks. |
| UpdateWebhook | [UpdateWebhookRequest](#memos-api-v2-UpdateWebhookRequest) | [UpdateWebhookResponse](#memos-api-v2-UpdateWebhookResponse) | UpdateWebhook updates a webhook. |
| DeleteWebhook | [DeleteWebhookRequest](#memos-api-v2-DeleteWebhookRequest) | [DeleteWebhookResponse](#memos-api-v2-DeleteWebhookResponse) | DeleteWebhook deletes a webhook by id. |

 



<a name="api_v2_workspace_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/workspace_service.proto



<a name="memos-api-v2-GetWorkspaceProfileRequest"></a>

### GetWorkspaceProfileRequest







<a name="memos-api-v2-GetWorkspaceProfileResponse"></a>

### GetWorkspaceProfileResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| workspace_profile | [WorkspaceProfile](#memos-api-v2-WorkspaceProfile) |  |  |






<a name="memos-api-v2-WorkspaceProfile"></a>

### WorkspaceProfile



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| owner | [string](#string) |  | The name of intance owner. Format: &#34;users/{id}&#34; |
| version | [string](#string) |  | version is the current version of instance |
| mode | [string](#string) |  | mode is the instance mode (e.g. &#34;prod&#34;, &#34;dev&#34; or &#34;demo&#34;). |





 

 

 


<a name="memos-api-v2-WorkspaceService"></a>

### WorkspaceService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| GetWorkspaceProfile | [GetWorkspaceProfileRequest](#memos-api-v2-GetWorkspaceProfileRequest) | [GetWorkspaceProfileResponse](#memos-api-v2-GetWorkspaceProfileResponse) | GetWorkspaceProfile returns the workspace profile. |

 



<a name="api_v2_workspace_setting_service-proto"></a>
<p align="right"><a href="#top">Top</a></p>

## api/v2/workspace_setting_service.proto



<a name="memos-api-v2-GetWorkspaceSettingRequest"></a>

### GetWorkspaceSettingRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | The resource name of the workspace setting. Format: settings/{setting} |






<a name="memos-api-v2-GetWorkspaceSettingResponse"></a>

### GetWorkspaceSettingResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [WorkspaceSetting](#memos-api-v2-WorkspaceSetting) |  |  |






<a name="memos-api-v2-ListWorkspaceSettingsRequest"></a>

### ListWorkspaceSettingsRequest







<a name="memos-api-v2-ListWorkspaceSettingsResponse"></a>

### ListWorkspaceSettingsResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| settings | [WorkspaceSetting](#memos-api-v2-WorkspaceSetting) | repeated |  |






<a name="memos-api-v2-SetWorkspaceSettingRequest"></a>

### SetWorkspaceSettingRequest



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [WorkspaceSetting](#memos-api-v2-WorkspaceSetting) |  | setting is the setting to update. |






<a name="memos-api-v2-SetWorkspaceSettingResponse"></a>

### SetWorkspaceSettingResponse



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| setting | [WorkspaceSetting](#memos-api-v2-WorkspaceSetting) |  |  |






<a name="memos-api-v2-WorkspaceCustomProfile"></a>

### WorkspaceCustomProfile



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| title | [string](#string) |  |  |
| description | [string](#string) |  |  |
| logo_url | [string](#string) |  |  |
| locale | [string](#string) |  |  |
| appearance | [string](#string) |  |  |






<a name="memos-api-v2-WorkspaceGeneralSetting"></a>

### WorkspaceGeneralSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| instance_url | [string](#string) |  | instance_url is the instance URL. |
| disallow_signup | [bool](#bool) |  | disallow_signup is the flag to disallow signup. |
| disallow_password_login | [bool](#bool) |  | disallow_password_login is the flag to disallow password login. |
| additional_script | [string](#string) |  | additional_script is the additional script. |
| additional_style | [string](#string) |  | additional_style is the additional style. |
| custom_profile | [WorkspaceCustomProfile](#memos-api-v2-WorkspaceCustomProfile) |  | custom_profile is the custom profile. |






<a name="memos-api-v2-WorkspaceMemoRelatedSetting"></a>

### WorkspaceMemoRelatedSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| disallow_public_visible | [bool](#bool) |  | disallow_public_share disallows set memo as public visible. |
| display_with_update_time | [bool](#bool) |  | display_with_update_time orders and displays memo with update time. |






<a name="memos-api-v2-WorkspaceSetting"></a>

### WorkspaceSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| name | [string](#string) |  | name is the name of the setting. Format: settings/{setting} |
| general_setting | [WorkspaceGeneralSetting](#memos-api-v2-WorkspaceGeneralSetting) |  |  |
| storage_setting | [WorkspaceStorageSetting](#memos-api-v2-WorkspaceStorageSetting) |  |  |
| memo_related_setting | [WorkspaceMemoRelatedSetting](#memos-api-v2-WorkspaceMemoRelatedSetting) |  |  |
| telegram_integration_setting | [WorkspaceTelegramIntegrationSetting](#memos-api-v2-WorkspaceTelegramIntegrationSetting) |  |  |






<a name="memos-api-v2-WorkspaceStorageSetting"></a>

### WorkspaceStorageSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| storage_type | [WorkspaceStorageSetting.StorageType](#memos-api-v2-WorkspaceStorageSetting-StorageType) |  | storage_type is the storage type. |
| actived_external_storage_id | [int32](#int32) | optional | The id of actived external storage. |
| local_storage_path | [string](#string) |  | The local storage path for STORAGE_TYPE_LOCAL. e.g. assets/{timestamp}_{filename} |
| upload_size_limit_mb | [int64](#int64) |  | The max upload size in megabytes. |






<a name="memos-api-v2-WorkspaceTelegramIntegrationSetting"></a>

### WorkspaceTelegramIntegrationSetting



| Field | Type | Label | Description |
| ----- | ---- | ----- | ----------- |
| bot_token | [string](#string) |  | bot_token is the telegram bot token. |





 


<a name="memos-api-v2-WorkspaceStorageSetting-StorageType"></a>

### WorkspaceStorageSetting.StorageType


| Name | Number | Description |
| ---- | ------ | ----------- |
| STORAGE_TYPE_UNSPECIFIED | 0 |  |
| STORAGE_TYPE_DATABASE | 1 | STORAGE_TYPE_DATABASE is the database storage type. |
| STORAGE_TYPE_LOCAL | 2 | STORAGE_TYPE_LOCAL is the local storage type. |
| STORAGE_TYPE_EXTERNAL | 3 | STORAGE_TYPE_EXTERNAL is the external storage type. |


 

 


<a name="memos-api-v2-WorkspaceSettingService"></a>

### WorkspaceSettingService


| Method Name | Request Type | Response Type | Description |
| ----------- | ------------ | ------------- | ------------|
| ListWorkspaceSettings | [ListWorkspaceSettingsRequest](#memos-api-v2-ListWorkspaceSettingsRequest) | [ListWorkspaceSettingsResponse](#memos-api-v2-ListWorkspaceSettingsResponse) | ListWorkspaceSetting returns the list of settings. |
| GetWorkspaceSetting | [GetWorkspaceSettingRequest](#memos-api-v2-GetWorkspaceSettingRequest) | [GetWorkspaceSettingResponse](#memos-api-v2-GetWorkspaceSettingResponse) | GetWorkspaceSetting returns the setting by name. |
| SetWorkspaceSetting | [SetWorkspaceSettingRequest](#memos-api-v2-SetWorkspaceSettingRequest) | [SetWorkspaceSettingResponse](#memos-api-v2-SetWorkspaceSettingResponse) | SetWorkspaceSetting updates the setting. |

 



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

