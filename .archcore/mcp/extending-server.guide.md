---
title: "Extending the MCP server"
status: draft
tags:
  - "mcp"
---

Reader: a Go contributor who adds a tool to the Memos MCP server. Task: expose one more REST operation as an MCP tool. Step actor: the contributor.

## Prerequisites
- A checkout of the repository with the Go toolchain, and `buf` for proto generation (`@proto/buf.gen.yaml`).
- The MCP service is already wired. `server.NewServer` in `@server/server.go` calls `mcp.NewMCPService(profile, echoServer)` after it registers the API, file, and gRPC-gateway routes, then calls `mcpService.RegisterRoutes(echoServer)`. A construction error is wrapped as `failed to create MCP service`.
- The server advertises the tools capability only, with no prompts or resources in this version.
- Production reads the OpenAPI spec from `proto.OpenAPIYAML()` (`loadMCPServiceOpenAPISpec` in `@server/mcp/service.go`). The path-based `loadOpenAPISpec` in `@server/mcp/openapi.go` exists for tests.
- Argument validation is two-layered: `validateToolArguments` runs a hand-rolled structural check (`validateSchemaValue`) first, which yields friendly messages, then the `google/jsonschema-go` validator second, as the spec-complete backstop.

## Steps
1. Add the operation's OpenAPI `operationId` to `curatedOperationIDs` in `@server/mcp/catalog.go`.
2. If the operation is not in `@proto/gen/openapi.yaml`, add or adjust the proto/API surface first.
3. Warning: never hand-edit `@proto/gen/openapi.yaml` or other generated output. Change the proto definitions instead, then regenerate:
   ```bash
   cd proto && buf generate
   ```
4. Extend `@server/mcp/catalog_test.go` and `@server/mcp/service_test.go` to cover the new tool.
5. Run the package tests:
   ```bash
   go test ./server/mcp/...
   ```

## Verification
- `go test ./server/mcp/...` passes. The test files cover these areas:
  - `@server/mcp/openapi_test.go`: spec parsing, registry building, `$ref` resolution.
  - `@server/mcp/catalog_test.go`: tool selection, naming, schema and annotation building.
  - `@server/mcp/adapter_test.go`: request construction and in-process execution, the client-address peer, result normalization, and error shaping.
  - `@server/mcp/validation_test.go`: argument validation against input schemas.
  - `@server/mcp/service_test.go`: the origin-header check; the stateless `2026-07-28` flow (`server/discover`, `tools/list`, `tools/call` with MCP headers); the request body limit; client-address forwarding; the legacy `initialize` → `tools/list` → `tools/call` flow with object-shaped `structuredContent`.
- Optional manual check: point a Streamable HTTP MCP client at `https://<your-instance>/mcp` with a personal access token, then list tools:
  ```json
  {
    "mcpServers": {
      "memos": {
        "type": "http",
        "url": "https://<your-instance>/mcp",
        "headers": { "Authorization": "Bearer <your-personal-access-token>" }
      }
    }
  }
  ```

## Common Issues
- Startup fails with `curated OpenAPI operation "<id>" not found`. The ID is missing from the generated OpenAPI; do steps 2–3.
- Startup fails with `duplicate MCP tool name "<name>"`. Two operation IDs map to the same snake_case tool name.
- Startup fails with `requestBodySchemaOverrides references unknown operation "<id>"` (or the idempotent or destructive table). An override key is stale, for example after a proto RPC rename; update the key in `@server/mcp/catalog.go`.
