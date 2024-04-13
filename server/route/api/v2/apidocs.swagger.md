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
## IdentityProviderService

### /api/v2/identityProviders

#### GET
##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListIdentityProvidersResponse](#v2listidentityprovidersresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| identityProvider.name | query | The name of the identityProvider. Format: identityProviders/{id} | No | string |
| identityProvider.type | query |  | No | string |
| identityProvider.title | query |  | No | string |
| identityProvider.identifierFilter | query |  | No | string |
| identityProvider.config.oauth2Config.clientId | query |  | No | string |
| identityProvider.config.oauth2Config.clientSecret | query |  | No | string |
| identityProvider.config.oauth2Config.authUrl | query |  | No | string |
| identityProvider.config.oauth2Config.tokenUrl | query |  | No | string |
| identityProvider.config.oauth2Config.userInfoUrl | query |  | No | string |
| identityProvider.config.oauth2Config.scopes | query |  | No | [ string ] |
| identityProvider.config.oauth2Config.fieldMapping.identifier | query |  | No | string |
| identityProvider.config.oauth2Config.fieldMapping.displayName | query |  | No | string |
| identityProvider.config.oauth2Config.fieldMapping.email | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateIdentityProviderResponse](#v2createidentityproviderresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{identityProvider.name}

#### PATCH
##### Summary

UpdateIdentityProvider updates an identity provider.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| identityProvider.name | path | The name of the identityProvider. Format: identityProviders/{id} | Yes | string |
| identityProvider | body | The identityProvider to update. | Yes | { **"type"**: [apiv2IdentityProviderType](#apiv2identityprovidertype), **"title"**: string, **"identifierFilter"**: string, **"config"**: [apiv2IdentityProviderConfig](#apiv2identityproviderconfig) } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateIdentityProviderResponse](#v2updateidentityproviderresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_1}

#### GET
##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_1 | path | The name of the identityProvider to get. Format: identityProviders/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetIdentityProviderResponse](#v2getidentityproviderresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteIdentityProvider deletes an identity provider.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_1 | path | The name of the identityProvider to delete. Format: identityProviders/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteIdentityProviderResponse](#v2deleteidentityproviderresponse) |
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
| user | query | Format: users/{id} | No | string |

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
| inbox.name | path | The name of the inbox. Format: inboxes/{id} | Yes | string |
| inbox | body |  | Yes | { **"sender"**: string, **"receiver"**: string, **"status"**: [v2InboxStatus](#v2inboxstatus), **"createTime"**: dateTime, **"type"**: [v2InboxType](#v2inboxtype), **"activityId"**: integer } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateInboxResponse](#v2updateinboxresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_2}

#### GET
##### Summary

GetResource returns a resource by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_2 | path | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetResourceResponse](#v2getresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteInbox deletes an inbox.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_2 | path | The name of the inbox to delete. Format: inboxes/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteInboxResponse](#v2deleteinboxresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## LinkService

### /api/v2/link_metadata

#### GET
##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| link | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetLinkMetadataResponse](#v2getlinkmetadataresponse) |
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
| filter | query | Filter is used to filter memos returned in the list. Format: "creator == users/{uid} && visibilities == ['PUBLIC', 'PROTECTED']" | No | string |

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

### /api/v2/memos/stats

#### GET
##### Summary

GetUserMemosStats gets stats of memos for a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | query | name is the name of the user to get stats for. Format: users/{id} | No | string |
| timezone | query | timezone location Format: uses tz identifier https://en.wikipedia.org/wiki/List_of_tz_database_time_zones | No | string |
| filter | query | Same as ListMemosRequest.filter | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetUserMemosStatsResponse](#v2getusermemosstatsresponse) |
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

### /api/v2/memos:search

#### GET
##### Summary

SearchMemos searches memos.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| filter | query | Filter is used to filter memos returned. Format: "creator == users/{uid} && visibilities == ['PUBLIC', 'PROTECTED']" | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SearchMemosResponse](#v2searchmemosresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/reactions/{reactionId}

#### DELETE
##### Summary

DeleteMemoReaction deletes a reaction for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| reactionId | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteMemoReactionResponse](#v2deletememoreactionresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{memo.name}

#### PATCH
##### Summary

UpdateMemo updates a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| memo.name | path | The name of the memo. Format: memos/{id} id is the system generated id. | Yes | string |
| memo | body |  | Yes | { **"uid"**: string, **"rowStatus"**: [v2RowStatus](#v2rowstatus), **"creator"**: string, **"createTime"**: dateTime, **"updateTime"**: dateTime, **"displayTime"**: dateTime, **"content"**: string, **"visibility"**: [v2Visibility](#v2visibility), **"pinned"**: boolean, **"parentId"**: integer, **"resources"**: [ [v2Resource](#v2resource) ], **"relations"**: [ [v2MemoRelation](#v2memorelation) ], **"reactions"**: [ [v2Reaction](#v2reaction) ] } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateMemoResponse](#v2updatememoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_3}

#### GET
##### Summary

GetMemo gets a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_3 | path | The name of the memo. Format: memos/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetMemoResponse](#v2getmemoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteResource deletes a resource by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_3 | path | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteResourceResponse](#v2deleteresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_4}

#### DELETE
##### Summary

DeleteMemo deletes a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_4 | path | The name of the memo. Format: memos/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteMemoResponse](#v2deletememoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/comments

#### GET
##### Summary

ListMemoComments lists comments for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the memo. Format: memos/{id} | Yes | string |

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
| name | path | The name of the memo. Format: memos/{id} | Yes | string |
| comment.content | query |  | No | string |
| comment.visibility | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateMemoCommentResponse](#v2creatememocommentresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/reactions

#### GET
##### Summary

ListMemoReactions lists reactions for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the memo. Format: memos/{id} | Yes | string |

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
| name | path | The name of the memo. Format: memos/{id} | Yes | string |
| reaction.id | query |  | No | integer |
| reaction.creator | query | The name of the creator. Format: users/{id} | No | string |
| reaction.contentId | query |  | No | string |
| reaction.reactionType | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpsertMemoReactionResponse](#v2upsertmemoreactionresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/relations

#### GET
##### Summary

ListMemoRelations lists relations for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the memo. Format: memos/{id} | Yes | string |

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
| name | path | The name of the memo. Format: memos/{id} | Yes | string |
| body | body |  | Yes | [MemoServiceSetMemoRelationsBody](#memoservicesetmemorelationsbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SetMemoRelationsResponse](#v2setmemorelationsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}/resources

#### GET
##### Summary

ListMemoResources lists resources for a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the memo. Format: memos/{id} | Yes | string |

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
| name | path | The name of the memo. Format: memos/{id} | Yes | string |
| body | body |  | Yes | [MemoServiceSetMemoResourcesBody](#memoservicesetmemoresourcesbody) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SetMemoResourcesResponse](#v2setmemoresourcesresponse) |
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
| resource.name | query | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | No | string |
| resource.uid | query | The user defined id of the resource. | No | string |
| resource.createTime | query |  | No | dateTime |
| resource.filename | query |  | No | string |
| resource.content | query |  | No | byte |
| resource.externalLink | query |  | No | string |
| resource.type | query |  | No | string |
| resource.size | query |  | No | string (int64) |
| resource.memo | query | The related memo. Format: memos/{id} | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateResourceResponse](#v2createresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/resources:search

#### GET
##### Summary

SearchResources searches memos.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| filter | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SearchResourcesResponse](#v2searchresourcesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_2}

#### GET
##### Summary

GetResource returns a resource by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_2 | path | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetResourceResponse](#v2getresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteInbox deletes an inbox.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_2 | path | The name of the inbox to delete. Format: inboxes/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteInboxResponse](#v2deleteinboxresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name_3}

#### GET
##### Summary

GetMemo gets a memo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_3 | path | The name of the memo. Format: memos/{id} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetMemoResponse](#v2getmemoresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteResource deletes a resource by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name_3 | path | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteResourceResponse](#v2deleteresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{resource.name}

#### PATCH
##### Summary

UpdateResource updates a resource.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| resource.name | path | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | Yes | string |
| resource | body |  | Yes | { **"uid"**: string, **"createTime"**: dateTime, **"filename"**: string, **"content"**: byte, **"externalLink"**: string, **"type"**: string, **"size"**: string (int64), **"memo"**: string } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateResourceResponse](#v2updateresourceresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

---
## StorageService

### /api/v2/storages

#### GET
##### Summary

ListStorages returns a list of storages.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListStoragesResponse](#v2liststoragesresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### POST
##### Summary

CreateStorage creates a new storage.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| body | body |  | Yes | [v2CreateStorageRequest](#v2createstoragerequest) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2CreateStorageResponse](#v2createstorageresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/storages/{id}

#### GET
##### Summary

GetStorage returns a storage by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetStorageResponse](#v2getstorageresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

#### DELETE
##### Summary

DeleteStorage deletes a storage by id.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| id | path |  | Yes | integer |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2DeleteStorageResponse](#v2deletestorageresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/storages/{storage.id}

#### PATCH
##### Summary

UpdateStorage updates a storage.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| storage.id | path |  | Yes | integer |
| storage | body |  | Yes | { **"title"**: string, **"type"**: [apiv2StorageType](#apiv2storagetype), **"config"**: [apiv2StorageConfig](#apiv2storageconfig) } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2UpdateStorageResponse](#v2updatestorageresponse) |
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
| user | query | The creator of tags. Format: users/{id} | No | string |

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
| tag.creator | query | The creator of tags. Format: users/{id} | No | string |

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
| user | query | The creator of tags. Format: users/{id} | No | string |

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
| user | query | The creator of tags. Format: users/{id} | No | string |
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

### /api/v2/users:search

#### GET
##### Summary

SearchUsers searches users by filter.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| filter | query | Filter is used to filter users returned in the list. Format: "username == frank" | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SearchUsersResponse](#v2searchusersresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/{name}

#### GET
##### Summary

GetUser gets a user by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The name of the user. Format: users/{id} | Yes | string |

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
| name | path | The name of the user. Format: users/{id} | Yes | string |

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
| name | path | The name of the user. Format: users/{id} | Yes | string |

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
| name | path | The name of the user. Format: users/{id} | Yes | string |
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
| name | path | The name of the user. Format: users/{id} | Yes | string |
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
| name | path | The name of the user. Format: users/{id} | Yes | string |

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
| setting.name | path | The name of the user. Format: users/{id} | Yes | string |
| setting | body |  | Yes | { **"locale"**: string, **"appearance"**: string, **"memoVisibility"**: string } |

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
| user.name | path | The name of the user. Format: users/{id} | Yes | string |
| user | body |  | Yes | { **"id"**: integer, **"role"**: [UserRole](#userrole), **"username"**: string, **"email"**: string, **"nickname"**: string, **"avatarUrl"**: string, **"description"**: string, **"password"**: string, **"rowStatus"**: [v2RowStatus](#v2rowstatus), **"createTime"**: dateTime, **"updateTime"**: dateTime } |

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
| webhook | body |  | Yes | { **"creatorId"**: integer, **"createdTime"**: dateTime, **"updatedTime"**: dateTime, **"rowStatus"**: [v2RowStatus](#v2rowstatus), **"name"**: string, **"url"**: string } |

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

---
## WorkspaceSettingService

### /api/v2/workspace/settings

#### GET
##### Summary

ListWorkspaceSetting returns the list of settings.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2ListWorkspaceSettingsResponse](#v2listworkspacesettingsresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/workspace/{name}

#### GET
##### Summary

GetWorkspaceSetting returns the setting by name.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| name | path | The resource name of the workspace setting. Format: settings/{setting} | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2GetWorkspaceSettingResponse](#v2getworkspacesettingresponse) |
| default | An unexpected error response. | [googlerpcStatus](#googlerpcstatus) |

### /api/v2/workspace/{setting.name}

#### PATCH
##### Summary

SetWorkspaceSetting updates the setting.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ------ |
| setting.name | path | name is the name of the setting. Format: settings/{setting} | Yes | string |
| setting | body | setting is the setting to update. | Yes | { **"generalSetting"**: [apiv2WorkspaceGeneralSetting](#apiv2workspacegeneralsetting), **"storageSetting"**: [apiv2WorkspaceStorageSetting](#apiv2workspacestoragesetting), **"memoRelatedSetting"**: [apiv2WorkspaceMemoRelatedSetting](#apiv2workspacememorelatedsetting) } |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | A successful response. | [v2SetWorkspaceSettingResponse](#v2setworkspacesettingresponse) |
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

#### apiv2FieldMapping

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| identifier | string |  | No |
| displayName | string |  | No |
| email | string |  | No |

#### apiv2IdentityProvider

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| type | [apiv2IdentityProviderType](#apiv2identityprovidertype) |  | No |
| title | string |  | No |
| identifierFilter | string |  | No |
| config | [apiv2IdentityProviderConfig](#apiv2identityproviderconfig) |  | No |

#### apiv2IdentityProviderConfig

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| oauth2Config | [apiv2OAuth2Config](#apiv2oauth2config) |  | No |

#### apiv2IdentityProviderType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| apiv2IdentityProviderType | string |  |  |

#### apiv2OAuth2Config

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| clientId | string |  | No |
| clientSecret | string |  | No |
| authUrl | string |  | No |
| tokenUrl | string |  | No |
| userInfoUrl | string |  | No |
| scopes | [ string ] |  | No |
| fieldMapping | [apiv2FieldMapping](#apiv2fieldmapping) |  | No |

#### apiv2S3Config

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| endPoint | string |  | No |
| path | string |  | No |
| region | string |  | No |
| accessKey | string |  | No |
| secretKey | string |  | No |
| bucket | string |  | No |
| urlPrefix | string |  | No |
| urlSuffix | string |  | No |
| preSign | boolean |  | No |

#### apiv2Storage

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| title | string |  | No |
| type | [apiv2StorageType](#apiv2storagetype) |  | No |
| config | [apiv2StorageConfig](#apiv2storageconfig) |  | No |

#### apiv2StorageConfig

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| s3Config | [apiv2S3Config](#apiv2s3config) |  | No |

#### apiv2StorageType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| apiv2StorageType | string |  |  |

#### apiv2UserSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| locale | string | The preferred locale of the user. | No |
| appearance | string | The preferred appearance of the user. | No |
| memoVisibility | string | The default visibility of the memo. | No |

#### apiv2WorkspaceCustomProfile

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| title | string |  | No |
| description | string |  | No |
| logoUrl | string |  | No |
| locale | string |  | No |
| appearance | string |  | No |

#### apiv2WorkspaceGeneralSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| instanceUrl | string | instance_url is the instance URL. | No |
| disallowSignup | boolean | disallow_signup is the flag to disallow signup. | No |
| disallowPasswordLogin | boolean | disallow_password_login is the flag to disallow password login. | No |
| additionalScript | string | additional_script is the additional script. | No |
| additionalStyle | string | additional_style is the additional style. | No |
| customProfile | [apiv2WorkspaceCustomProfile](#apiv2workspacecustomprofile) | custom_profile is the custom profile. | No |

#### apiv2WorkspaceMemoRelatedSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| disallowPublicVisible | boolean | disallow_public_share disallows set memo as public visible. | No |
| displayWithUpdateTime | boolean | display_with_update_time orders and displays memo with update time. | No |

#### apiv2WorkspaceSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| generalSetting | [apiv2WorkspaceGeneralSetting](#apiv2workspacegeneralsetting) |  | No |
| storageSetting | [apiv2WorkspaceStorageSetting](#apiv2workspacestoragesetting) |  | No |
| memoRelatedSetting | [apiv2WorkspaceMemoRelatedSetting](#apiv2workspacememorelatedsetting) |  | No |

#### apiv2WorkspaceStorageSetting

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storageType | [apiv2WorkspaceStorageSettingStorageType](#apiv2workspacestoragesettingstoragetype) | storage_type is the storage type. | No |
| activedExternalStorageId | integer | The id of actived external storage. | No |
| localStoragePathTemplate | string |  | No |
| uploadSizeLimitMb | string (int64) | The max upload size in megabytes. | No |

#### apiv2WorkspaceStorageSettingStorageType

- STORAGE_TYPE_DATABASE: STORAGE_TYPE_DATABASE is the database storage type.
- STORAGE_TYPE_LOCAL: STORAGE_TYPE_LOCAL is the local storage type.
- STORAGE_TYPE_EXTERNAL: STORAGE_TYPE_EXTERNAL is the external storage type.

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| apiv2WorkspaceStorageSettingStorageType | string |  - STORAGE_TYPE_DATABASE: STORAGE_TYPE_DATABASE is the database storage type.  - STORAGE_TYPE_LOCAL: STORAGE_TYPE_LOCAL is the local storage type.  - STORAGE_TYPE_EXTERNAL: STORAGE_TYPE_EXTERNAL is the external storage type. |  |

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

#### v2CreateIdentityProviderResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| identityProvider | [apiv2IdentityProvider](#apiv2identityprovider) | The created identityProvider. | No |

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

#### v2CreateStorageRequest

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storage | [apiv2Storage](#apiv2storage) |  | No |

#### v2CreateStorageResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storage | [apiv2Storage](#apiv2storage) |  | No |

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
| webhook | [v2Webhook](#v2webhook) |  | No |

#### v2DeleteIdentityProviderResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteIdentityProviderResponse | object |  |  |

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

#### v2DeleteStorageResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2DeleteStorageResponse | object |  |  |

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

#### v2GetIdentityProviderResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| identityProvider | [apiv2IdentityProvider](#apiv2identityprovider) | The identityProvider. | No |

#### v2GetLinkMetadataResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| linkMetadata | [v2LinkMetadata](#v2linkmetadata) |  | No |

#### v2GetMemoResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | [v2Memo](#v2memo) |  | No |

#### v2GetResourceResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resource | [v2Resource](#v2resource) |  | No |

#### v2GetStorageResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storage | [apiv2Storage](#apiv2storage) |  | No |

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
| webhook | [v2Webhook](#v2webhook) |  | No |

#### v2GetWorkspaceProfileResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| workspaceProfile | [v2WorkspaceProfile](#v2workspaceprofile) |  | No |

#### v2GetWorkspaceSettingResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| setting | [apiv2WorkspaceSetting](#apiv2workspacesetting) |  | No |

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

#### v2LinkMetadata

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| title | string |  | No |
| description | string |  | No |
| image | string |  | No |

#### v2ListIdentityProvidersResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| identityProviders | [ [apiv2IdentityProvider](#apiv2identityprovider) ] |  | No |

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
| reactions | [ [v2Reaction](#v2reaction) ] |  | No |

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

#### v2ListStoragesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storages | [ [apiv2Storage](#apiv2storage) ] |  | No |

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
| webhooks | [ [v2Webhook](#v2webhook) ] |  | No |

#### v2ListWorkspaceSettingsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| settings | [ [apiv2WorkspaceSetting](#apiv2workspacesetting) ] |  | No |

#### v2Memo

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string | The name of the memo. Format: memos/{id} id is the system generated id. | No |
| uid | string | The user defined id of the memo. | No |
| rowStatus | [v2RowStatus](#v2rowstatus) |  | No |
| creator | string |  | No |
| createTime | dateTime |  | No |
| updateTime | dateTime |  | No |
| displayTime | dateTime |  | No |
| content | string |  | No |
| visibility | [v2Visibility](#v2visibility) |  | No |
| pinned | boolean |  | No |
| parentId | integer |  | No |
| resources | [ [v2Resource](#v2resource) ] |  | No |
| relations | [ [v2MemoRelation](#v2memorelation) ] |  | No |
| reactions | [ [v2Reaction](#v2reaction) ] |  | No |

#### v2MemoRelation

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memo | string |  | No |
| relatedMemo | string |  | No |
| type | [v2MemoRelationType](#v2memorelationtype) |  | No |

#### v2MemoRelationType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2MemoRelationType | string |  |  |

#### v2Reaction

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| creator | string |  | No |
| contentId | string |  | No |
| reactionType | [v2ReactionType](#v2reactiontype) |  | No |

#### v2ReactionType

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2ReactionType | string |  |  |

#### v2RenameTagResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| tag | [v2Tag](#v2tag) |  | No |

#### v2Resource

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string | The name of the resource. Format: resources/{id} id is the system generated unique identifier. | No |
| uid | string | The user defined id of the resource. | No |
| createTime | dateTime |  | No |
| filename | string |  | No |
| content | byte |  | No |
| externalLink | string |  | No |
| type | string |  | No |
| size | string (int64) |  | No |
| memo | string |  | No |

#### v2RowStatus

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2RowStatus | string |  |  |

#### v2SearchMemosResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| memos | [ [v2Memo](#v2memo) ] |  | No |

#### v2SearchResourcesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| resources | [ [v2Resource](#v2resource) ] |  | No |

#### v2SearchUsersResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| users | [ [v2User](#v2user) ] |  | No |

#### v2SetMemoRelationsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2SetMemoRelationsResponse | object |  |  |

#### v2SetMemoResourcesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| v2SetMemoResourcesResponse | object |  |  |

#### v2SetWorkspaceSettingResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| setting | [apiv2WorkspaceSetting](#apiv2workspacesetting) |  | No |

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

#### v2UpdateIdentityProviderResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| identityProvider | [apiv2IdentityProvider](#apiv2identityprovider) | The updated identityProvider. | No |

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

#### v2UpdateStorageResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| storage | [apiv2Storage](#apiv2storage) |  | No |

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
| webhook | [v2Webhook](#v2webhook) |  | No |

#### v2UpsertMemoReactionResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| reaction | [v2Reaction](#v2reaction) |  | No |

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
| id | integer | The system generated uid of the user. | No |
| role | [UserRole](#userrole) |  | No |
| username | string |  | No |
| email | string |  | No |
| nickname | string |  | No |
| avatarUrl | string |  | No |
| description | string |  | No |
| password | string |  | No |
| rowStatus | [v2RowStatus](#v2rowstatus) |  | No |
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

#### v2Webhook

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| id | integer |  | No |
| creatorId | integer |  | No |
| createdTime | dateTime |  | No |
| updatedTime | dateTime |  | No |
| rowStatus | [v2RowStatus](#v2rowstatus) |  | No |
| name | string |  | No |
| url | string |  | No |

#### v2WorkspaceProfile

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| owner | string |  | No |
| version | string |  | No |
| mode | string | mode is the instance mode (e.g. "prod", "dev" or "demo"). | No |
