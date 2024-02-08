# api/v2/activity_service.proto
## Version: version not set

---
## AuthService

### /api/v2/auth/signin

#### POST
##### Summary

SignIn signs in the user with the given username and password.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| username | query |  | No | string |
| password | query |  | No | string |
| neverExpire | query |  | No | boolean |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SignInResponse](#v2signinresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/auth/signin/sso

#### POST
##### Summary

SignInWithSSO signs in the user with the given SSO code.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| idpId | query |  | No | integer |
| code | query |  | No | string |
| redirectUri | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SignInWithSSOResponse](#v2signinwithssoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/auth/signout

#### POST
##### Summary

SignOut signs out the user.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SignOutResponse](#v2signoutresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/auth/signup

#### POST
##### Summary

SignUp signs up the user with the given username and password.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| username | query |  | No | string |
| password | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SignUpResponse](#v2signupresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/auth/status

#### POST
##### Summary

GetAuthStatus returns the current auth status of the user.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetAuthStatusResponse](#v2getauthstatusresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## InboxService

### /api/v2/inboxes

#### GET
##### Summary

ListInboxes lists inboxes for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user | query | Format: users/{username} | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListInboxesResponse](#v2listinboxesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{inbox.name}

#### PATCH
##### Summary

UpdateInbox updates an inbox.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| inbox.name | path | The name of the inbox. Format: inboxes/{uid} | Yes | string |
| inbox | body |  | Yes | { **"sender"**: string, **"receiver"**: string, **"status"**: [v2InboxStatus](#v2inboxstatus), **"createTime"**: dateTime, **"type"**: [v2InboxType](#v2inboxtype), **"activityId"**: integer } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateInboxResponse](#v2updateinboxresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_1}

#### DELETE
##### Summary

DeleteInbox deletes an inbox.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_1 | path | The name of the inbox to delete. Format: inboxes/{uid} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteInboxResponse](#v2deleteinboxresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## MemoService

### /api/v2/memos

#### GET
##### Summary

ListMemos lists memos with pagination and filter.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| pageSize | query | The maximum number of memos to return. | No | integer |
| pageToken | query | A page token, received from a previous `ListMemos` call. Provide this to retrieve the subsequent page. | No | string |
| filter | query | Filter is used to filter memos returned in the list. Format: "creator == users/{username} && visibilities == ['PUBLIC', 'PROTECTED']" | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListMemosResponse](#v2listmemosresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateMemo creates a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| body | body |  | Yes | [v2CreateMemoRequest](#v2creatememorequest) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateMemoResponse](#v2creatememoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/name/{name}

#### GET
##### Summary

GetMemoByName gets a memo by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetMemoByNameResponse](#v2getmemobynameresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/stats

#### GET
##### Summary

GetUserMemosStats gets stats of memos for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | query | name is the name of the user to get stats for. Format: users/{username} | No | string |
| timezone | query | timezone location Format: uses tz identifier https://en.wikipedia.org/wiki/List_of_tz_database_time_zones | No | string |
| filter | query | Same as ListMemosRequest.filter | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetUserMemosStatsResponse](#v2getusermemosstatsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}

#### GET
##### Summary

GetMemo gets a memo by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetMemoResponse](#v2getmemoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteMemo deletes a memo by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteMemoResponse](#v2deletememoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}/comments

#### GET
##### Summary

ListMemoComments lists comments for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListMemoCommentsResponse](#v2listmemocommentsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateMemoComment creates a comment for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path | id is the memo id to create comment for. | Yes | integer |
| create.content | query |  | No | string |
| create.visibility | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateMemoCommentResponse](#v2creatememocommentresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}/reactions

#### GET
##### Summary

ListMemoReactions lists reactions for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListMemoReactionsResponse](#v2listmemoreactionsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

UpsertMemoReaction upserts a reaction for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |
| reaction.id | query |  | No | integer |
| reaction.creator | query |  | No | string |
| reaction.contentId | query |  | No | string |
| reaction.reactionType | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpsertMemoReactionResponse](#v2upsertmemoreactionresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}/reactions/{reactionId}

#### DELETE
##### Summary

DeleteMemoReaction deletes a reaction for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |
| reactionId | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteMemoReactionResponse](#v2deletememoreactionresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}/relations

#### GET
##### Summary

ListMemoRelations lists relations for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListMemoRelationsResponse](#v2listmemorelationsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

SetMemoRelations sets relations for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |
| body | body |  | Yes | [MemoServiceSetMemoRelationsBody](#memoservicesetmemorelationsbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SetMemoRelationsResponse](#v2setmemorelationsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{id}/resources

#### GET
##### Summary

ListMemoResources lists resources for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListMemoResourcesResponse](#v2listmemoresourcesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

SetMemoResources sets resources for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |
| body | body |  | Yes | [MemoServiceSetMemoResourcesBody](#memoservicesetmemoresourcesbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SetMemoResourcesResponse](#v2setmemoresourcesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos/{memo.id}

#### PATCH
##### Summary

UpdateMemo updates a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| memo.id | path | id is the system generated unique identifier. | Yes | integer |
| memo | body |  | Yes | { **"name"**: string, **"rowStatus"**: [apiv2RowStatus](#apiv2rowstatus), **"creator"**: string, **"creatorId"**: integer, **"createTime"**: dateTime, **"updateTime"**: dateTime, **"displayTime"**: dateTime, **"content"**: string, **"visibility"**: [v2Visibility](#v2visibility), **"pinned"**: boolean, **"parentId"**: integer, **"resources"**: [ [v2Resource](#v2resource) ], **"relations"**: [ [v2MemoRelation](#v2memorelation) ], **"reactions"**: [ [apiv2Reaction](#apiv2reaction) ] } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateMemoResponse](#v2updatememoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/memos:export

#### POST
##### Summary

ExportMemos exports memos.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| filter | query | Same as ListMemosRequest.filter | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ExportMemosResponse](#v2exportmemosresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## ResourceService

### /api/v2/resources

#### GET
##### Summary

ListResources lists all resources.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListResourcesResponse](#v2listresourcesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateResource creates a new resource.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| filename | query |  | No | string |
| externalLink | query |  | No | string |
| type | query |  | No | string |
| memoId | query |  | No | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateResourceResponse](#v2createresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/resources/name/{name}

#### GET
##### Summary

GetResourceByName returns a resource by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetResourceByNameResponse](#v2getresourcebynameresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/resources/{id}

#### GET
##### Summary

GetResource returns a resource by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetResourceResponse](#v2getresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteResource deletes a resource by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteResourceResponse](#v2deleteresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/resources/{resource.id}

#### PATCH
##### Summary

UpdateResource updates a resource.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| resource.id | path | id is the system generated unique identifier. | Yes | integer |
| resource | body |  | Yes | { **"name"**: string, **"createTime"**: dateTime, **"filename"**: string, **"externalLink"**: string, **"type"**: string, **"size"**: string (int64), **"memoId"**: integer } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateResourceResponse](#v2updateresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## TagService

### /api/v2/tags

#### GET
##### Summary

ListTags lists tags.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user | query | The creator of tags. Format: users/{username} | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListTagsResponse](#v2listtagsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteTag deletes a tag.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| tag.name | query |  | No | string |
| tag.creator | query | The creator of tags. Format: users/{username} | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteTagResponse](#v2deletetagresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

UpsertTag upserts a tag.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpsertTagResponse](#v2upserttagresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/tags/suggestion

#### GET
##### Summary

GetTagSuggestions gets tag suggestions from the user's memos.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user | query | The creator of tags. Format: users/{username} | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetTagSuggestionsResponse](#v2gettagsuggestionsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/tags:batchUpsert

#### POST
##### Summary

BatchUpsertTag upserts multiple tags.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2BatchUpsertTagResponse](#v2batchupserttagresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/tags:rename

#### PATCH
##### Summary

RenameTag renames a tag.
All related memos will be updated.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user | query | The creator of tags. Format: users/{username} | No | string |
| oldName | query |  | No | string |
| newName | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2RenameTagResponse](#v2renametagresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## UserService

### /api/v2/users

#### GET
##### Summary

ListUsers returns a list of users.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListUsersResponse](#v2listusersresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateUser creates a new user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user | body |  | Yes | [v2User](#v2user) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateUserResponse](#v2createuserresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}

#### GET
##### Summary

GetUser gets a user by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetUserResponse](#v2getuserresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteUser deletes a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteUserResponse](#v2deleteuserresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/access_tokens

#### GET
##### Summary

ListUserAccessTokens returns a list of access tokens for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListUserAccessTokensResponse](#v2listuseraccesstokensresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateUserAccessToken creates a new access token for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |
| body | body |  | Yes | [UserServiceCreateUserAccessTokenBody](#userservicecreateuseraccesstokenbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateUserAccessTokenResponse](#v2createuseraccesstokenresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/access_tokens/{accessToken}

#### DELETE
##### Summary

DeleteUserAccessToken deletes an access token for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |
| accessToken | path | access_token is the access token to delete. | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteUserAccessTokenResponse](#v2deleteuseraccesstokenresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/setting

#### GET
##### Summary

GetUserSetting gets the setting of a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{username} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetUserSettingResponse](#v2getusersettingresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{setting.name}

#### PATCH
##### Summary

UpdateUserSetting updates the setting of a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| setting.name | path | The name of the user. Format: users/{username} | Yes | string |
| setting | body |  | Yes | { **"locale"**: string, **"appearance"**: string, **"memoVisibility"**: string, **"telegramUserId"**: string, **"compactView"**: boolean } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateUserSettingResponse](#v2updateusersettingresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{user.name}

#### PATCH
##### Summary

UpdateUser updates a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| user.name | path | The name of the user. Format: users/{username} | Yes | string |
| user | body |  | Yes | { **"id"**: integer, **"role"**: [UserRole](#userrole), **"username"**: string, **"email"**: string, **"nickname"**: string, **"avatarUrl"**: string, **"password"**: string, **"rowStatus"**: [apiv2RowStatus](#apiv2rowstatus), **"createTime"**: dateTime, **"updateTime"**: dateTime } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateUserResponse](#v2updateuserresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## WebhookService

### /api/v2/webhooks

#### GET
##### Summary

ListWebhooks returns a list of webhooks.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| creatorId | query |  | No | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListWebhooksResponse](#v2listwebhooksresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateWebhook creates a new webhook.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| body | body |  | Yes | [v2CreateWebhookRequest](#v2createwebhookrequest) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateWebhookResponse](#v2createwebhookresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/webhooks/{id}

#### GET
##### Summary

GetWebhook returns a webhook by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetWebhookResponse](#v2getwebhookresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteWebhook deletes a webhook by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteWebhookResponse](#v2deletewebhookresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/webhooks/{webhook.id}

#### PATCH
##### Summary

UpdateWebhook updates a webhook.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| webhook.id | path |  | Yes | integer |
| webhook | body |  | Yes | { **"creatorId"**: integer, **"createdTime"**: dateTime, **"updatedTime"**: dateTime, **"rowStatus"**: [apiv2RowStatus](#apiv2rowstatus), **"name"**: string, **"url"**: string } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateWebhookResponse](#v2updatewebhookresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## WorkspaceService

### /api/v2/workspace/profile

#### GET
##### Summary

GetWorkspaceProfile returns the workspace profile.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetWorkspaceProfileResponse](#v2getworkspaceprofileresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### PATCH
##### Summary

UpdateWorkspaceProfile updates the workspace profile.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| workspaceProfile | body | System info is the updated data. | Yes | [v2WorkspaceProfile](#v2workspaceprofile) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateWorkspaceProfileResponse](#v2updateworkspaceprofileresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## ActivityService

### /v2/activities/{id}

#### GET
##### Summary

GetActivity returns the activity with the given id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetActivityResponse](#v2getactivityresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
### Models

#### MemoServiceSetMemoRelationsBody

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| relations | [ [v2MemoRelation](#v2memorelation) ] |  | No |

#### MemoServiceSetMemoResourcesBody

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resources | [ [v2Resource](#v2resource) ] |  | No |

#### UserRole

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| UserRole | string |  |  |

#### UserServiceCreateUserAccessTokenBody

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| description | string |  | No |
| expiresAt | dateTime |  | No |

#### apiv2ActivityMemoCommentPayload

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memoId | integer |  | No |
| relatedMemoId | integer |  | No |

#### apiv2ActivityPayload

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memoComment | [apiv2ActivityMemoCommentPayload](#apiv2activitymemocommentpayload) |  | No |
| versionUpdate | [apiv2ActivityVersionUpdatePayload](#apiv2activityversionupdatepayload) |  | No |

#### apiv2ActivityVersionUpdatePayload

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| version | string |  | No |

#### apiv2Reaction

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| creator | string |  | No |
| contentId | string |  | No |
| reactionType | [apiv2ReactionType](#apiv2reactiontype) |  | No |

#### apiv2ReactionType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| apiv2ReactionType | string |  |  |

#### apiv2RowStatus

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| apiv2RowStatus | string |  |  |

#### apiv2UserSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| locale | string | The preferred locale of the user. | No |
| appearance | string | The preferred appearance of the user. | No |
| memoVisibility | string | The default visibility of the memo. | No |
| telegramUserId | string | The telegram user id of the user. | No |
| compactView | boolean | The compact view for a memo. | No |

#### apiv2Webhook

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| creatorId | integer |  | No |
| createdTime | dateTime |  | No |
| updatedTime | dateTime |  | No |
| rowStatus | [apiv2RowStatus](#apiv2rowstatus) |  | No |
| name | string |  | No |
| url | string |  | No |

#### googlerpcStatus

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| code | integer |  | No |
| message | string |  | No |
| details | [ [protobufAny](#protobufany) ] |  | No |

#### protobufAny

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| @type | string |  | No |

#### v2Activity

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| creatorId | integer |  | No |
| type | string |  | No |
| level | string |  | No |
| createTime | dateTime |  | No |
| payload | [apiv2ActivityPayload](#apiv2activitypayload) |  | No |

#### v2BatchUpsertTagResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2BatchUpsertTagResponse | object |  |  |

#### v2CreateMemoCommentResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2CreateMemoRequest

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| content | string |  | No |
| visibility | [v2Visibility](#v2visibility) |  | No |

#### v2CreateMemoResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2CreateResourceResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resource | [v2Resource](#v2resource) |  | No |

#### v2CreateUserAccessTokenResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| accessToken | [v2UserAccessToken](#v2useraccesstoken) |  | No |

#### v2CreateUserResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2CreateWebhookRequest

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| url | string |  | No |

#### v2CreateWebhookResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| webhook | [apiv2Webhook](#apiv2webhook) |  | No |

#### v2DeleteInboxResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteInboxResponse | object |  |  |

#### v2DeleteMemoReactionResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteMemoReactionResponse | object |  |  |

#### v2DeleteMemoResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteMemoResponse | object |  |  |

#### v2DeleteResourceResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteResourceResponse | object |  |  |

#### v2DeleteTagResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteTagResponse | object |  |  |

#### v2DeleteUserAccessTokenResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteUserAccessTokenResponse | object |  |  |

#### v2DeleteUserResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteUserResponse | object |  |  |

#### v2DeleteWebhookResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteWebhookResponse | object |  |  |

#### v2ExportMemosResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| content | byte |  | No |

#### v2GetActivityResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| activity | [v2Activity](#v2activity) |  | No |

#### v2GetAuthStatusResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2GetMemoByNameResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2GetMemoResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2GetResourceByNameResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resource | [v2Resource](#v2resource) |  | No |

#### v2GetResourceResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resource | [v2Resource](#v2resource) |  | No |

#### v2GetTagSuggestionsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| tags | [ string ] |  | No |

#### v2GetUserMemosStatsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| stats | object | stats is the stats of memo creating/updating activities. key is the year-month-day string. e.g. "2020-01-01". | No |

#### v2GetUserResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2GetUserSettingResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| setting | [apiv2UserSetting](#apiv2usersetting) |  | No |

#### v2GetWebhookResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| webhook | [apiv2Webhook](#apiv2webhook) |  | No |

#### v2GetWorkspaceProfileResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| workspaceProfile | [v2WorkspaceProfile](#v2workspaceprofile) |  | No |

#### v2Inbox

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| sender | string |  | No |
| receiver | string |  | No |
| status | [v2InboxStatus](#v2inboxstatus) |  | No |
| createTime | dateTime |  | No |
| type | [v2InboxType](#v2inboxtype) |  | No |
| activityId | integer |  | No |

#### v2InboxStatus

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2InboxStatus | string |  |  |

#### v2InboxType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2InboxType | string |  |  |

#### v2ListInboxesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| inboxes | [ [v2Inbox](#v2inbox) ] |  | No |

#### v2ListMemoCommentsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memos | [ [v2Memo](#v2memo) ] |  | No |

#### v2ListMemoReactionsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| reactions | [ [apiv2Reaction](#apiv2reaction) ] |  | No |

#### v2ListMemoRelationsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| relations | [ [v2MemoRelation](#v2memorelation) ] |  | No |

#### v2ListMemoResourcesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resources | [ [v2Resource](#v2resource) ] |  | No |

#### v2ListMemosResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memos | [ [v2Memo](#v2memo) ] |  | No |
| nextPageToken | string | A token, which can be sent as `page_token` to retrieve the next page. If this field is omitted, there are no subsequent pages. | No |

#### v2ListResourcesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resources | [ [v2Resource](#v2resource) ] |  | No |

#### v2ListTagsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| tags | [ [v2Tag](#v2tag) ] |  | No |

#### v2ListUserAccessTokensResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| accessTokens | [ [v2UserAccessToken](#v2useraccesstoken) ] |  | No |

#### v2ListUsersResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| users | [ [v2User](#v2user) ] |  | No |

#### v2ListWebhooksResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| webhooks | [ [apiv2Webhook](#apiv2webhook) ] |  | No |

#### v2Memo

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer | id is the system generated unique identifier. | No |
| name | string | name is the user provided name. | No |
| rowStatus | [apiv2RowStatus](#apiv2rowstatus) |  | No |
| creator | string |  | No |
| creatorId | integer |  | No |
| createTime | dateTime |  | No |
| updateTime | dateTime |  | No |
| displayTime | dateTime |  | No |
| content | string |  | No |
| visibility | [v2Visibility](#v2visibility) |  | No |
| pinned | boolean |  | No |
| parentId | integer |  | No |
| resources | [ [v2Resource](#v2resource) ] |  | No |
| relations | [ [v2MemoRelation](#v2memorelation) ] |  | No |
| reactions | [ [apiv2Reaction](#apiv2reaction) ] |  | No |

#### v2MemoRelation

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memoId | integer |  | No |
| relatedMemoId | integer |  | No |
| type | [v2MemoRelationType](#v2memorelationtype) |  | No |

#### v2MemoRelationType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2MemoRelationType | string |  |  |

#### v2RenameTagResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| tag | [v2Tag](#v2tag) |  | No |

#### v2Resource

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer | id is the system generated unique identifier. | No |
| name | string | name is the user provided name. | No |
| createTime | dateTime |  | No |
| filename | string |  | No |
| externalLink | string |  | No |
| type | string |  | No |
| size | string (int64) |  | No |
| memoId | integer |  | No |

#### v2SetMemoRelationsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2SetMemoRelationsResponse | object |  |  |

#### v2SetMemoResourcesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2SetMemoResourcesResponse | object |  |  |

#### v2SignInResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2SignInWithSSOResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2SignOutResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2SignOutResponse | object |  |  |

#### v2SignUpResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2Tag

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| creator | string |  | No |

#### v2UpdateInboxResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| inbox | [v2Inbox](#v2inbox) |  | No |

#### v2UpdateMemoResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2UpdateResourceResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resource | [v2Resource](#v2resource) |  | No |

#### v2UpdateUserResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| user | [v2User](#v2user) |  | No |

#### v2UpdateUserSettingResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| setting | [apiv2UserSetting](#apiv2usersetting) |  | No |

#### v2UpdateWebhookResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| webhook | [apiv2Webhook](#apiv2webhook) |  | No |

#### v2UpdateWorkspaceProfileResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| workspaceProfile | [v2WorkspaceProfile](#v2workspaceprofile) |  | No |

#### v2UpsertMemoReactionResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| reaction | [apiv2Reaction](#apiv2reaction) |  | No |

#### v2UpsertTagRequest

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |

#### v2UpsertTagResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| tag | [v2Tag](#v2tag) |  | No |

#### v2User

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| id | integer |  | No |
| role | [UserRole](#userrole) |  | No |
| username | string |  | No |
| email | string |  | No |
| nickname | string |  | No |
| avatarUrl | string |  | No |
| password | string |  | No |
| rowStatus | [apiv2RowStatus](#apiv2rowstatus) |  | No |
| createTime | dateTime |  | No |
| updateTime | dateTime |  | No |

#### v2UserAccessToken

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| accessToken | string |  | No |
| description | string |  | No |
| issuedAt | dateTime |  | No |
| expiresAt | dateTime |  | No |

#### v2Visibility

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2Visibility | string |  |  |

#### v2WorkspaceProfile

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| version | string |  | No |
| mode | string |  | No |
| allowRegistration | boolean |  | No |
| disablePasswordLogin | boolean |  | No |
| additionalScript | string |  | No |
| additionalStyle | string |  | No |
