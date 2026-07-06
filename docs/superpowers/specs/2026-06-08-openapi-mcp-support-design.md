# OpenAPI-Driven MCP Support Design

## Context

Memos previously had an MCP server, but it was removed in commit `2a4638b3` and should not be used as the baseline for this work. GitHub issue #6022 reported that some old MCP tools returned a bare JSON array in `result.structuredContent`, which strict MCP clients reject because `structuredContent` must be an object.

The new MCP support should start from zero and use the generated OpenAPI document at `proto/gen/openapi.yaml` as the source of truth. The OpenAPI file already describes the public REST gateway operations generated from protobuf definitions, including operation IDs, descriptions, parameters, request schemas, and response schemas.

## Goals

- Add MCP support back through a new implementation that is mechanically tied to `proto/gen/openapi.yaml`.
- Expose a standard MCP Streamable HTTP endpoint at the `/mcp` path.
- Register tools only; do not add MCP resources or prompts in the first version.
- Expose a curated memo-focused toolset derived from OpenAPI operations, not every API endpoint.
- Execute MCP tool calls through the existing API contract instead of duplicating store or service logic.
- Return object-shaped `structuredContent` for every tool result.
- Keep authentication and authorization behavior aligned with the existing API.

## Non-Goals

- Reviving or adapting the removed MCP package design.
- Adding custom MCP route aliases, readonly endpoints, or toolset filtering headers.
- Exposing every operation in `proto/gen/openapi.yaml` as an MCP tool.
- Adding MCP tools for admin settings, users, identity providers, webhooks, personal access tokens, authentication, share-link management, AI transcription, or bulk deletion.
- Adding `list_tags` or `search_memos` unless matching proto/API operations are added and OpenAPI is regenerated.
- Hand-editing generated OpenAPI or generated protobuf outputs.

## Recommended Approach

Build a new `server/router/mcp` package that parses `proto/gen/openapi.yaml` at startup, selects a curated allowlist of operation IDs, and converts those selected OpenAPI operations into MCP tools. Tool calls map MCP arguments into the selected operation's path parameters, query parameters, and JSON body, then execute the corresponding `/api/v1/...` HTTP request through the existing Echo/gRPC-Gateway route in-process.

This approach keeps OpenAPI as the authoritative contract while avoiding the usability and safety problems of exposing a large API-mirrored tool surface.

## Architecture

### MCP Service

Create a new MCP service package under `server/router/mcp`. `server.NewServer` creates the existing `APIV1Service`, registers the normal file, RSS, and API routes, then registers a new MCP service against the same Echo server.

The service exposes one MCP endpoint path:

```text
/mcp
```

The implementation must support standard Streamable HTTP client messages on `POST /mcp`. It may also support `GET /mcp` and `DELETE /mcp` if the chosen MCP transport implementation requires those methods for standards-compliant streaming or session cleanup.

The first version advertises only the MCP tools capability. It does not advertise prompts or resources.

### OpenAPI Operation Registry

At startup, the MCP service loads `proto/gen/openapi.yaml` and builds an operation registry keyed by `operationId`. Each parsed operation stores:

- operation ID
- HTTP method
- OpenAPI route template
- description
- path parameters
- query parameters
- JSON request body schema
- HTTP 200 JSON response schema

The parser should fail fast during service construction if any curated operation ID is missing or cannot be converted into a valid MCP tool schema.

### Tool Names

Tool names are derived from OpenAPI `operationId` values and normalized for MCP clients. The exact naming convention should be deterministic and tested. A practical convention is lower snake case without the `Service` suffix in the subject:

```text
MemoService_ListMemos -> memo_list_memos
AttachmentService_GetAttachment -> attachment_get_attachment
```

The OpenAPI `operationId` remains stored in tool metadata so tests and future diagnostics can prove which OpenAPI operation produced each MCP tool.

### Tool Schemas

Each MCP tool input schema is an object built from:

- OpenAPI path parameters
- OpenAPI query parameters
- JSON request body fields, when present

Required path parameters stay required. Required request bodies stay required. Optional query parameters stay optional. The schema should preserve OpenAPI descriptions and primitive types where possible.

Each MCP tool output schema is the OpenAPI HTTP 200 JSON response schema. For empty 200 responses with no JSON schema, the MCP output schema is:

```json
{ "type": "object", "properties": { "ok": { "type": "boolean" } } }
```

## Tool Scope

The first version exposes these curated OpenAPI operations:

- `MemoService_ListMemos`
- `MemoService_CreateMemo`
- `MemoService_GetMemo`
- `MemoService_UpdateMemo`
- `MemoService_DeleteMemo`
- `MemoService_ListMemoComments`
- `MemoService_CreateMemoComment`
- `MemoService_ListMemoAttachments`
- `MemoService_SetMemoAttachments`
- `MemoService_ListMemoReactions`
- `MemoService_UpsertMemoReaction`
- `MemoService_DeleteMemoReaction`
- `MemoService_ListMemoRelations`
- `MemoService_SetMemoRelations`
- `AttachmentService_ListAttachments`
- `AttachmentService_GetAttachment`
- `AttachmentService_DeleteAttachment`

Excluded in the first version:

- auth sign-in, sign-out, and refresh
- user management
- personal access token management
- identity provider management
- webhooks
- instance settings
- share-link management
- AI transcription
- bulk delete operations
- any operation not present in generated OpenAPI

## Data Flow

### Startup

1. `server.NewServer` creates the existing `APIV1Service`.
2. The new `MCPService` loads `proto/gen/openapi.yaml`.
3. The OpenAPI parser builds the operation registry.
4. The curated operation allowlist selects supported operations.
5. Each selected operation is registered as an MCP tool with input schema, output schema, description, annotations, and operation metadata.

### Tool Call

1. The client sends a standard MCP `tools/call` request to `/mcp`.
2. The MCP server validates the tool name and arguments against the OpenAPI-derived input schema.
3. The adapter substitutes path parameters into the OpenAPI route template.
4. The adapter encodes query parameters into the query string.
5. The adapter marshals request body arguments as JSON when the operation has a request body.
6. The adapter forwards the caller's `Authorization` header and executes the matching `/api/v1/...` request through the existing Echo handler in-process.
7. The API response JSON is decoded into `map[string]any`.
8. The MCP result returns a compact JSON text fallback plus object-shaped `structuredContent`.

## Result Shape

Every MCP result must use object-shaped `structuredContent`.

Rules:

- If the API response is a JSON object, return it unchanged.
- If the API response is empty, return `{ "ok": true }`.
- If an unexpected raw JSON array appears, wrap it as `{ "result": [...] }`.
- If an unexpected scalar appears, wrap it as `{ "result": value }`.

This directly addresses issue #6022 by preventing collection tools from returning bare arrays.

## Authentication And Origin Safety

The MCP endpoint accepts the same bearer credentials as the API:

```text
Authorization: Bearer <PAT-or-access-token>
```

The MCP adapter forwards the bearer header to the in-process API request. Public API operations can work without authentication when the API allows them. Mutating operations require authentication because the API already enforces that behavior.

For browser-origin safety, `/mcp` rejects cross-origin browser requests unless the `Origin` header is same-origin or matches the configured instance URL. Requests without an `Origin` header are allowed because desktop MCP clients commonly omit it.

## Errors

The MCP server should convert failures into MCP tool errors:

- Invalid MCP arguments: concise validation message.
- API `401` or `403`: preserve the API message where available.
- API `404`: report that the resource was not found.
- Other API errors: include the HTTP status code and decoded API message.
- Internal OpenAPI or adapter errors: log server-side details and return a concise tool error.

Adapter errors should not bypass MCP result formatting unless the underlying MCP framework requires protocol-level errors for invalid protocol messages.

## Tool Annotations

Tool annotations are derived from HTTP methods:

- `GET`: read-only, non-destructive, idempotent.
- `POST`: mutating unless the operation is explicitly known to be read-only.
- `PATCH`: mutating, non-idempotent by default.
- `DELETE`: destructive and idempotent by default.

These annotations are hints for clients and do not replace API authorization.

## Testing

### OpenAPI Parsing Tests

Tests should verify:

- every curated operation ID exists in `proto/gen/openapi.yaml`
- every selected tool has an object input schema
- every selected tool has an object output schema
- selected operations do not include admin, auth, webhook, identity provider, personal access token, instance setting, share-link, AI transcription, or bulk-delete operations
- tool names are deterministic and unique

### MCP Protocol Tests

Using an Echo test server and JSON-RPC requests, tests should verify:

- `initialize` succeeds
- `tools/list` returns only curated OpenAPI-derived tools
- tool definitions include input and output schemas
- no prompts or resources capabilities are advertised
- collection tool calls return object-shaped `structuredContent`, never a bare array

### Adapter Tests

Representative adapter tests should cover:

- `GET /api/v1/memos?pageSize=...`
- `POST /api/v1/memos`
- `GET /api/v1/memos/{memo}`
- `PATCH /api/v1/memos/{memo}`
- `DELETE /api/v1/memos/{memo}`
- `GET /api/v1/memos/{memo}/comments`
- `POST /api/v1/memos/{memo}/reactions`

Before finishing implementation, run:

```bash
go test ./server/router/mcp/... ./server/router/api/v1/... ./server/...
```

## Implementation Notes

- Do not hand-edit `proto/gen/openapi.yaml`.
- If a needed MCP tool is not represented by OpenAPI, add or adjust the proto/API surface first, run `cd proto && buf generate`, then derive the MCP tool from the regenerated OpenAPI.
- Prefer existing API auth and gateway behavior over duplicating authorization logic in the MCP adapter.
- Keep the first version intentionally small. Additional OpenAPI-derived tools can be added by extending the curated allowlist and tests.
