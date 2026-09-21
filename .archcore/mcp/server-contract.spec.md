---
title: "MCP server contract"
status: draft
tags:
  - "mcp"
---

## Purpose & Scope
This spec defines the Memos MCP endpoint at `/mcp`: startup, transport, request handling, tool catalog, schemas, annotations, result shape, and errors. It is normative for `@server/mcp/`. External MCP clients depend on it, and the REST API under `/api/v1/` serves every call. Tool calls run in-process against the existing REST API; the package owns no store or service logic. Out of scope: REST API behavior, and task-level evaluations.

## Surface
- Construction and route: `NewMCPService`, `RegisterRoutes`, `newMCPToolHandler` in `@server/mcp/service.go`; called by `server.NewServer` in `@server/server.go`.
- OpenAPI source: `proto.OpenAPIYAML()` in `@proto/openapi_embed.go`, embedding `@proto/gen/openapi.yaml`.
- Registry and `$ref` resolution: `buildOperationRegistry`, `resolveSchemaRef`, `addSchemaDef` in `@server/mcp/openapi.go`.
- Catalog: `curatedOperationIDs`, `toolNameFromOperationID`, `inputSchemaForOperation`, `requestBodySchemaOverrides`, `annotationsForOperation` in `@server/mcp/catalog.go`.
- Adapter: `apiAdapter.execute`, `buildAPIRequest`, `apiErrorMessage` in `@server/mcp/adapter.go`.
- Validation: `validateToolArguments` in `@server/mcp/validation.go`. Origin check: `isAllowedMCPOrigin` in `@server/mcp/origin.go`.
- Results: `normalizeStructuredContent`, `newStructuredToolResult`, `newToolErrorResult` in `@server/mcp/result.go`.
- Gateway encoding: `newGatewayMarshaler` in `@server/api/v1/v1.go`. Body limit: `maxMCPRequestBytes` = `apiv1.MaxAPIRequestBytes` (256 MiB).
- Client URL: `https://<instance>/mcp` over Streamable HTTP, with a personal access token as bearer credential.

## Normative Behavior
1. WHEN `NewMCPService` runs, the service MUST parse the embedded `proto.OpenAPIYAML()` bytes into an OpenAPI spec.
2. The registry builder MUST index every operation by `operationId` with method, path, resolved request-body schema, and resolved 200 response schema.
3. The catalog builder MUST convert each ID in `curatedOperationIDs` into one `*sdkmcp.Tool` and one `registeredOperation`.
4. The service MUST register each tool with `server.AddTool` and a handler built by `newMCPToolHandler`.
5. The service MUST wrap the server with `sdkmcp.NewStreamableHTTPHandler` in stateless, JSON-response mode, with no SSE and no session tracking.
6. The service MUST pass the API-wide body limit to the transport instead of the SDK's 4 MiB default.
7. The service MUST advertise the tools capability only: no prompts, no resources, and no `listChanged`.
8. WHEN a client calls `tools/list` or `server/discover`, the service MUST return a `ttlMs` of 24 hours.
9. The service MUST serve protocol version `2026-07-28` through the stateless handler.
10. WHEN an older client uses the legacy `initialize` handshake, the service MUST negotiate version `2025-11-25` or earlier.
11. WHEN a client uses `2026-07-28`, the client MUST skip `initialize`, call `server/discover`, and carry `_meta.io.modelcontextprotocol/protocolVersion` on every request.
12. WHEN a client uses `2026-07-28`, the client MUST send `Mcp-Protocol-Version` and `Mcp-Method` headers, plus `Mcp-Name` on `tools/call`.
13. WHEN a request reaches `/mcp`, the route MUST run `isAllowedMCPOrigin` before SDK dispatch.
14. The route MUST cap the request body at 256 MiB before the SDK reads it.
15. WHEN a `tools/call` arrives, the handler MUST decode the JSON arguments into a map.
16. The handler MUST validate the arguments against the tool's input schema with `validateToolArguments`.
17. The validator MUST run the structural check `validateSchemaValue` first and the `google/jsonschema-go` validator second.
18. The handler MUST read the caller's `Authorization` header from `request.Extra.Header` of the `*sdkmcp.CallToolRequest`.
19. The adapter MUST build the API request with path-parameter substitution, query encoding, and a JSON body (`buildAPIRequest`).
20. The adapter MUST forward the caller's bearer token to the in-process API request.
21. The adapter MUST set the caller's resolved client address, read from the handler context, as the in-process request peer.
22. The adapter MUST run the request against the same Echo server through an `httptest.ResponseRecorder`.
23. WHEN the API responds 2xx, the adapter MUST wrap the decoded body with `newStructuredToolResult`.
24. WHEN a mutating tool is called, the caller MUST supply a valid personal access token or access token.
25. WHILE no token is supplied, public read tools MAY succeed exactly as the REST API allows.
26. IF the `Origin` header is absent, THEN the origin check MUST allow the request.
27. WHEN the `Origin` host equals the request `Host` header, the origin check MUST allow the request without comparing the scheme.
28. WHEN the `Origin` scheme and host equal those of `profile.InstanceURL`, the origin check MUST allow the request.
29. The resolver MUST expand the outermost `$ref` of each request-body and 200-response schema in place (`inlineRef = true`).
30. The resolver MUST rewrite each nested `$ref` to `#/$defs/<Name>` and collect the component into `$defs` (`addSchemaDef`).
31. WHEN a component references itself, the resolver MUST terminate by seeding `defs[name]` and tracking `resolving[name]` before recursing.
32. The input schema MUST expose path and query parameters as top-level properties and keep required parameters in `required`.
33. WHEN an operation has a request body, the input schema MUST expose it as one `body` property with its `$defs` lifted to the top level.
34. WHEN the request body is required, the input schema MUST list `body` in `required`.
35. The input schema MUST set `"additionalProperties": false`.
36. The schema builder MUST relax resource-level required fields for create and partial-update bodies listed in `requestBodySchemaOverrides`.
37. The schema builder MUST remove fields already bound from the path from `body: "*"` schemas.
38. WHEN a memo or space is updated, the caller MAY omit `updateMask`; the REST gateway infers it from the body fields.
39. WHEN a `body: "*"` binding's only field is path-bound (accept or decline a space invitation), the input schema MUST make `body` optional.
40. The output schema MUST be the operation's 200 `application/json` schema.
41. IF the 200 response has no JSON body, THEN the output schema MUST be `{ "type": "object", "properties": { "ok": { "type": "boolean" } } }`.
42. The catalog MUST expose exactly the operations in `curatedOperationIDs`: memo, attachment, and space operations, plus `UserService_ListMemoViews` and `AuthService_GetCurrentUser`.
43. The catalog MUST NOT expose any auth or identity operation other than `AuthService_GetCurrentUser`.
44. The catalog MUST name each tool by dropping the `Service` suffix and joining snake_case subject and method with `_` (`MemoService_ListMemos` → `memo_list_memos`).
45. The catalog MUST annotate GET tools as ReadOnly, not Destructive, Idempotent.
46. The catalog MUST annotate DELETE tools as not ReadOnly, Destructive, Idempotent.
47. The catalog MUST annotate tools of other methods (POST, PATCH, and the rest) as not ReadOnly, not Destructive, not Idempotent.
48. The catalog MUST set `IdempotentHint` and `DestructiveHint` to true for `MemoService_SetMemoAttachments` and `MemoService_SetMemoRelations`.
49. The catalog MUST report `DestructiveHint: true` for `MemoService_UpdateMemo`, `SpaceService_UpdateSpace`, and `SpaceService_UpdateSpaceMember`.
50. The catalog MUST set `OpenWorldHint` to `false` for every tool.
51. WHEN the API returns a JSON object, the result MUST carry it unchanged as `structuredContent`.
52. WHEN the API returns an empty response, the result MUST carry `{ "ok": true }`.
53. WHEN the API returns a bare array or a scalar, the result MUST carry `{ "result": <value> }`.
54. Inside the envelope, the adapter MUST pass the API's JSON through verbatim.
55. The gateway marshaler MUST omit unset message fields instead of emitting `null` (`newGatewayMarshaler`).

## Constraints & Invariants
- Invariant: OpenAPI is the single source of truth; each tool derives from one generated operation and reuses the API's authentication and authorization.
- Invariant: the catalog is fixed at startup, which is why no change notifications exist.
- Invariant: every successful result carries object-shaped `structuredContent`; strict MCP clients reject bare arrays ([issue #6022](https://github.com/usememos/memos/issues/6022)).
- Invariant: no output schema declares `null`, so unset fields are omitted; `"motionMedia": null` failed attachment tools ([issue #6139](https://github.com/usememos/memos/issues/6139)).
- Constraint: the body limit equals the API limit so attachment uploads are not cut off.
- Constraint: without the peer rewrite, every call presents `httptest`'s placeholder `192.0.2.1`, and anonymous callers share one rate-limit bucket.
- Constraint: the origin check guards against browser DNS rebinding; the SDK's own localhost protection is disabled (`DisableLocalhostProtection`).
- Constraint: `MemoService_SetMemoAttachments` and `MemoService_SetMemoRelations` are PATCH but declaratively replace the full set on a memo, which is why both carry `IdempotentHint` and `DestructiveHint`.
- Constraint: `MemoService_UpdateMemo`, `SpaceService_UpdateSpace`, and `SpaceService_UpdateSpaceMember` report `DestructiveHint: true` because they overwrite existing fields, a member's role included.
- Annotations are client hints; they do not replace API authorization. `SpaceService_DeleteSpace` also deletes every memo placed in the space.
- [assumption] The oldest negotiable protocol version is `2024-11-05`; the SDK v1.7.0 version list was not checked.

## Failure Behavior
1. IF a curated ID is missing from the registry or two tools share a name, THEN `NewMCPService` MUST return a construction error.
2. IF an override table names an operation absent from the registry, THEN `NewMCPService` MUST return a construction error.
3. IF the origin check rejects a request, THEN the route MUST respond `403`.
4. WHEN a tool call fails, the handler MUST return a `CallToolResult` with `IsError: true`, a text block, and a nil Go error.
5. The handler MUST NOT report tool failures as JSON-RPC protocol errors.
6. The handler MUST omit `structuredContent` from error results so clients do not validate them against the success schema.
7. IF arguments are not valid JSON or fail schema validation, THEN the handler MUST return a tool error with the decode or validation message.
8. IF a required path parameter is missing, THEN the adapter MUST return the tool error `missing required path parameter "<name>"`.
9. IF a required request body is missing, THEN the adapter MUST return the tool error `missing required request body "body"`.
10. IF the API responds non-2xx, THEN the adapter MUST return `"<code> <reason phrase>: <api message>"` (`apiErrorMessage`).
11. IF the API response body is not decodable JSON, THEN the adapter MUST return a tool error with the decode message.

## Conformance
An implementation conforms when it meets behaviors 1–55, holds the invariants, and shapes every failure as above. Tests: `@server/mcp/service_test.go`, `@server/mcp/catalog_test.go`, `@server/mcp/adapter_test.go`, `@server/mcp/openapi_test.go`, `@server/mcp/validation_test.go`.
Given a curated collection tool whose API returns a bare array,
When a client calls it through `tools/call`,
Then `structuredContent` is `{ "result": [...] }`.
