# MCP Server

This package serves an [OpenAPI](https://www.openapis.org/)-driven
[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) endpoint at
`/mcp`. It exposes a curated, memo-focused toolset over the **Streamable HTTP**
transport using the official `github.com/modelcontextprotocol/go-sdk`.

The core design principle: **tool calls execute in-process against the existing
REST API.** The package owns no store or service logic of its own. Each tool is
derived from an operation in the generated OpenAPI document
(`proto/gen/openapi.yaml`, embedded via `proto.OpenAPIYAML()`), and a tool call
is translated into the matching `/api/v1/...` HTTP request and run against the
same Echo server that serves the public API. This keeps OpenAPI as the single
source of truth and reuses the API's authentication and authorization as-is.

## Integration

> Moved to [`.archcore/mcp/extending-server.guide.md`](../../.archcore/mcp/extending-server.guide.md).

## Startup flow

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

## Request flow

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

## Schema resolution

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

## Endpoint, transport & auth

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

- **Endpoint:** `POST /mcp` (the SDK may also use `GET`/`DELETE` on the same
  path for the Streamable HTTP transport).
- **Origin safety:** `isAllowedMCPOrigin` allows a request when the `Origin`
  header is absent (desktop clients commonly omit it), when its host matches
  the request `Host` header (host comparison only — scheme is not checked), or
  when it matches the configured `profile.InstanceURL`. Anything else gets
  `403`. This guards against DNS-rebinding from browsers.

### Connecting a client

> Moved to [`.archcore/mcp/extending-server.guide.md`](../../.archcore/mcp/extending-server.guide.md).

## Tool surface

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

The server exposes a curated allowlist (`curatedOperationIDs` in `catalog.go`),
centered on memos and attachments, plus the space service (memos carry a
placement and a `SPACE` audience, so agents must be able to discover and
administer spaces and answer invitations) and two read-only orientation tools:
`user_list_memo_views` (surfaces a user's named CEL filters for reuse with
`memo_list_memos`) and `auth_get_current_user` (a "whoami" so an agent can
resolve its own user — the single allowed auth/identity operation):

| OpenAPI operation | MCP tool |
| --- | --- |
| `MemoService_ListMemos` | `memo_list_memos` |
| `MemoService_CreateMemo` | `memo_create_memo` |
| `MemoService_GetMemo` | `memo_get_memo` |
| `MemoService_UpdateMemo` | `memo_update_memo` |
| `MemoService_DeleteMemo` | `memo_delete_memo` |
| `MemoService_ListMemoComments` | `memo_list_memo_comments` |
| `MemoService_CreateMemoComment` | `memo_create_memo_comment` |
| `MemoService_ListMemoAttachments` | `memo_list_memo_attachments` |
| `MemoService_SetMemoAttachments` | `memo_set_memo_attachments` |
| `MemoService_ListMemoReactions` | `memo_list_memo_reactions` |
| `MemoService_UpsertMemoReaction` | `memo_upsert_memo_reaction` |
| `MemoService_DeleteMemoReaction` | `memo_delete_memo_reaction` |
| `MemoService_ListMemoRelations` | `memo_list_memo_relations` |
| `MemoService_SetMemoRelations` | `memo_set_memo_relations` |
| `AttachmentService_ListAttachments` | `attachment_list_attachments` |
| `AttachmentService_CreateAttachment` | `attachment_create_attachment` |
| `AttachmentService_GetAttachment` | `attachment_get_attachment` |
| `AttachmentService_DeleteAttachment` | `attachment_delete_attachment` |
| `UserService_ListMemoViews` | `user_list_memo_views` |
| `AuthService_GetCurrentUser` | `auth_get_current_user` |
| `SpaceService_ListSpaces` | `space_list_spaces` |
| `SpaceService_GetSpace` | `space_get_space` |
| `SpaceService_CreateSpace` | `space_create_space` |
| `SpaceService_UpdateSpace` | `space_update_space` |
| `SpaceService_DeleteSpace` | `space_delete_space` |
| `SpaceService_ListSpaceMembers` | `space_list_space_members` |
| `SpaceService_GetSpaceMember` | `space_get_space_member` |
| `SpaceService_UpdateSpaceMember` | `space_update_space_member` |
| `SpaceService_DeleteSpaceMember` | `space_delete_space_member` |
| `SpaceService_ListSpaceInvitations` | `space_list_space_invitations` |
| `SpaceService_ListUserSpaceInvitations` | `space_list_user_space_invitations` |
| `SpaceService_GetSpaceInvitation` | `space_get_space_invitation` |
| `SpaceService_CreateSpaceInvitation` | `space_create_space_invitation` |
| `SpaceService_AcceptSpaceInvitation` | `space_accept_space_invitation` |
| `SpaceService_DeclineSpaceInvitation` | `space_decline_space_invitation` |
| `SpaceService_DeleteSpaceInvitation` | `space_delete_space_invitation` |

## Error handling

> Moved to [`.archcore/mcp/server-contract.spec.md`](../../.archcore/mcp/server-contract.spec.md).

## Core files

| File | Responsibility |
| --- | --- |
| `service.go` | Constructs the MCP server, registers tools, builds the streamable HTTP handler, and binds the `/mcp` route. |
| `catalog.go` | The curated operation allowlist, tool naming, input/output schema assembly, and method-derived annotations. |
| `adapter.go` | Translates a tool call into an `/api/v1/...` request and runs it in-process against the Echo server. |
| `openapi.go` | Parses the OpenAPI spec, builds the operation registry, and resolves `$ref` schemas into self-contained JSON Schema. |
| `validation.go` | Validates tool-call arguments against the tool's input schema. |
| `origin.go` | `Origin`-header check for browser DNS-rebinding safety. |
| `result.go` | Normalizes API responses into object-shaped `structuredContent` and builds error results. |

## Adding a tool

> Moved to [`.archcore/mcp/extending-server.guide.md`](../../.archcore/mcp/extending-server.guide.md).

## Testing

> Moved to [`.archcore/mcp/extending-server.guide.md`](../../.archcore/mcp/extending-server.guide.md).

## Design notes

> Moved to [`.archcore/mcp/extending-server.guide.md`](../../.archcore/mcp/extending-server.guide.md).
