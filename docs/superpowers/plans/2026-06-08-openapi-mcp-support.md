# OpenAPI-Driven MCP Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new standard MCP Streamable HTTP endpoint whose tools are derived from the generated `proto/gen/openapi.yaml` and execute through the existing Memos API contract.

**Architecture:** A new `server/router/mcp` package parses generated OpenAPI into an operation registry, selects a curated memo-focused operation allowlist, converts those operations into MCP tools using the official `github.com/modelcontextprotocol/go-sdk`, and dispatches tool calls to the existing Echo API handler in-process. The package owns tool schema generation, argument-to-HTTP mapping, result normalization, origin checks, and MCP route registration; API authorization remains enforced by the existing API middleware.

**Tech Stack:** Go 1.26.2 · Echo v5 · gRPC-Gateway JSON API · official MCP Go SDK `github.com/modelcontextprotocol/go-sdk` · `gopkg.in/yaml.v3` for generated OpenAPI parsing · `testify/require` for tests.

---

## File Structure

**Create:**
- `server/router/mcp/openapi.go` — OpenAPI YAML loading, schema representation, `$ref` resolution, curated operation lookup.
- `server/router/mcp/catalog.go` — curated operation IDs, tool naming, method-derived annotations, OpenAPI operation to MCP tool conversion.
- `server/router/mcp/adapter.go` — MCP arguments to HTTP path/query/body mapping, in-process API request execution, response decoding.
- `server/router/mcp/result.go` — object-shaped structured result normalization and tool error helpers.
- `server/router/mcp/origin.go` — same-origin and configured instance URL origin checks for `/mcp`.
- `server/router/mcp/service.go` — `MCPService`, official SDK server setup, tool registration, route registration.
- `server/router/mcp/openapi_test.go` — OpenAPI parser and curated operation tests.
- `server/router/mcp/catalog_test.go` — tool name, schema, annotation, and exclusion tests.
- `server/router/mcp/adapter_test.go` — path/query/body/result mapping tests against an Echo test server.
- `server/router/mcp/service_test.go` — MCP initialize/tools/list/tools/call protocol tests.

**Modify:**
- `go.mod` — add `github.com/modelcontextprotocol/go-sdk` in Task 3 when `server/router/mcp/catalog_test.go` first imports it.
- `go.sum` — updated by `go get`/`go mod tidy` in Task 3.
- `server/server.go` — import `server/router/mcp` and register the new MCP service after API routes are registered.

---

## Task 0: Commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-06-08-openapi-mcp-support.md`

- [ ] **Step 1: Commit the plan document on its own**

```bash
git add docs/superpowers/plans/2026-06-08-openapi-mcp-support.md
git commit -m "docs(mcp): plan OpenAPI-driven MCP support"
```

Expected: a docs-only commit that keeps the implementation plan separate from feature commits.

---

## Task 1: Removed standalone MCP SDK dependency task

**Files:**
- None

- [ ] **Step 1: Skip standalone dependency addition**

Do not add `github.com/modelcontextprotocol/go-sdk` as a standalone dependency. `go mod tidy -go=1.26.2` removes unused library dependencies when no Go source imports them yet, and this SDK must not be kept as a Go tool dependency. Add the SDK in Task 3 when catalog tests and implementation first import `github.com/modelcontextprotocol/go-sdk/mcp`.

```bash
go mod tidy -go=1.26.2
```

Expected: command succeeds. `github.com/modelcontextprotocol/go-sdk` is not present in `go.mod` or `go.sum`; generated or unrelated files do not change.

- [ ] **Step 2: Verify existing server packages**

```bash
go test ./server/...
```

Expected: PASS for existing server packages before MCP files are added.

- [ ] **Step 3: Commit plan correction if needed**

```bash
git add docs/superpowers/plans/2026-06-08-openapi-mcp-support.md go.mod go.sum
git commit -m "docs(mcp): fold SDK dependency into implementation task"
```

---

## Task 2: Build the OpenAPI operation registry

**Files:**
- Create: `server/router/mcp/openapi.go`
- Test: `server/router/mcp/openapi_test.go`

- [ ] **Step 1: Write failing tests for loading curated operations**

Create `server/router/mcp/openapi_test.go`:

```go
package mcp

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadOpenAPIOperationsIncludesCuratedIDs(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)

	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	curatedIDs := []string{
		"MemoService_ListMemos",
		"MemoService_CreateMemo",
		"MemoService_GetMemo",
		"MemoService_UpdateMemo",
		"MemoService_DeleteMemo",
		"MemoService_ListMemoComments",
		"MemoService_CreateMemoComment",
		"MemoService_ListMemoAttachments",
		"MemoService_SetMemoAttachments",
		"MemoService_ListMemoReactions",
		"MemoService_UpsertMemoReaction",
		"MemoService_DeleteMemoReaction",
		"MemoService_ListMemoRelations",
		"MemoService_SetMemoRelations",
		"AttachmentService_ListAttachments",
		"AttachmentService_GetAttachment",
		"AttachmentService_DeleteAttachment",
	}

	for _, operationID := range curatedIDs {
		operation, ok := registry[operationID]
		require.True(t, ok, "missing curated operation %s", operationID)
		require.NotEmpty(t, operation.Method, operationID)
		require.NotEmpty(t, operation.Path, operationID)
		require.NotEmpty(t, operation.Description, operationID)
		require.NotNil(t, operation.ResponseSchema, operationID)
	}

	createMemo := registry["MemoService_CreateMemo"]
	require.NotNil(t, createMemo.RequestBodySchema)
	require.Equal(t, "object", createMemo.RequestBodySchema["type"])
}

func TestBuildOperationRegistryRejectsDuplicateOperationIDs(t *testing.T) {
	spec := &openAPISpec{
		Paths: map[string]map[string]*openAPIOperation{
			"/a": {
				"get": {OperationID: "MemoService_GetMemo", Description: "first"},
			},
			"/b": {
				"get": {OperationID: "MemoService_GetMemo", Description: "second"},
			},
		},
	}

	_, err := buildOperationRegistry(spec)
	require.ErrorContains(t, err, "duplicate OpenAPI operationId")
}

func TestResolveSchemaRef(t *testing.T) {
	spec := &openAPISpec{
		Components: openAPIComponents{
			Schemas: map[string]jsonSchema{
				"ListMemosResponse": {
					"type": "object",
					"properties": map[string]any{
						"memos": map[string]any{"type": "array"},
					},
				},
			},
		},
	}

	schema, err := resolveSchemaRef(spec, jsonSchema{"$ref": "#/components/schemas/ListMemosResponse"})
	require.NoError(t, err)
	require.Equal(t, "object", schema["type"])
	require.Contains(t, schema["properties"], "memos")
}
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
go test ./server/router/mcp/... -run 'TestLoadOpenAPIOperationsIncludesCuratedIDs|TestBuildOperationRegistryRejectsDuplicateOperationIDs|TestResolveSchemaRef'
```

Expected: FAIL because `server/router/mcp` files and symbols do not exist.

- [ ] **Step 3: Implement `openapi.go`**

Create `server/router/mcp/openapi.go`:

```go
package mcp

import (
	"os"
	"strings"

	"github.com/pkg/errors"
	"gopkg.in/yaml.v3"
)

type jsonSchema map[string]any

type openAPISpec struct {
	OpenAPI    string                            `yaml:"openapi"`
	Paths      map[string]map[string]*openAPIOperation `yaml:"paths"`
	Components openAPIComponents                `yaml:"components"`
}

type openAPIComponents struct {
	Schemas map[string]jsonSchema `yaml:"schemas"`
}

type openAPIOperation struct {
	OperationID    string                    `yaml:"operationId"`
	Description    string                    `yaml:"description"`
	Parameters     []openAPIParameter        `yaml:"parameters"`
	RequestBody    *openAPIRequestBody       `yaml:"requestBody"`
	Responses      map[string]openAPIResponse `yaml:"responses"`
	Method         string                    `yaml:"-"`
	Path           string                    `yaml:"-"`
	ResponseSchema jsonSchema                `yaml:"-"`
	RequestBodySchema jsonSchema             `yaml:"-"`
}

type openAPIParameter struct {
	Name        string     `yaml:"name"`
	In          string     `yaml:"in"`
	Description string     `yaml:"description"`
	Required    bool       `yaml:"required"`
	Schema      jsonSchema `yaml:"schema"`
}

type openAPIRequestBody struct {
	Required bool                        `yaml:"required"`
	Content  map[string]openAPIMediaType `yaml:"content"`
}

type openAPIResponse struct {
	Description string                      `yaml:"description"`
	Content     map[string]openAPIMediaType `yaml:"content"`
}

type openAPIMediaType struct {
	Schema jsonSchema `yaml:"schema"`
}

func loadOpenAPISpec(path string) (*openAPISpec, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read OpenAPI spec")
	}
	spec := &openAPISpec{}
	if err := yaml.Unmarshal(data, spec); err != nil {
		return nil, errors.Wrap(err, "failed to parse OpenAPI spec")
	}
	if spec.Paths == nil {
		return nil, errors.New("OpenAPI spec has no paths")
	}
	return spec, nil
}

func buildOperationRegistry(spec *openAPISpec) (map[string]*openAPIOperation, error) {
	registry := map[string]*openAPIOperation{}
	for path, pathItem := range spec.Paths {
		for method, operation := range pathItem {
			if operation == nil || operation.OperationID == "" {
				continue
			}
			if _, exists := registry[operation.OperationID]; exists {
				return nil, errors.Errorf("duplicate OpenAPI operationId %q", operation.OperationID)
			}
			operation.Method = strings.ToUpper(method)
			operation.Path = path
			responseSchema, err := operationSuccessResponseSchema(spec, operation)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to resolve response schema for %s", operation.OperationID)
			}
			operation.ResponseSchema = responseSchema
			requestBodySchema, err := operationRequestBodySchema(spec, operation)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to resolve request body schema for %s", operation.OperationID)
			}
			operation.RequestBodySchema = requestBodySchema
			registry[operation.OperationID] = operation
		}
	}
	return registry, nil
}

func operationSuccessResponseSchema(spec *openAPISpec, operation *openAPIOperation) (jsonSchema, error) {
	response, ok := operation.Responses["200"]
	if !ok || response.Content == nil {
		return okSchema(), nil
	}
	mediaType, ok := response.Content["application/json"]
	if !ok || mediaType.Schema == nil {
		return okSchema(), nil
	}
	return resolveSchemaRef(spec, mediaType.Schema)
}

func operationRequestBodySchema(spec *openAPISpec, operation *openAPIOperation) (jsonSchema, error) {
	if operation.RequestBody == nil {
		return nil, nil
	}
	mediaType, ok := operation.RequestBody.Content["application/json"]
	if !ok || mediaType.Schema == nil {
		return jsonSchema{"type": "object"}, nil
	}
	return resolveSchemaRef(spec, mediaType.Schema)
}

func resolveSchemaRef(spec *openAPISpec, schema jsonSchema) (jsonSchema, error) {
	ref, ok := schema["$ref"].(string)
	if !ok || ref == "" {
		return schema, nil
	}
	const prefix = "#/components/schemas/"
	if !strings.HasPrefix(ref, prefix) {
		return nil, errors.Errorf("unsupported schema ref %q", ref)
	}
	name := strings.TrimPrefix(ref, prefix)
	resolved, ok := spec.Components.Schemas[name]
	if !ok {
		return nil, errors.Errorf("schema ref %q not found", ref)
	}
	return resolved, nil
}

func okSchema() jsonSchema {
	return jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"ok": map[string]any{"type": "boolean"},
		},
	}
}
```

- [ ] **Step 4: Run tests and verify parser tests pass**

```bash
go test ./server/router/mcp/... -run 'TestLoadOpenAPIOperationsIncludesCuratedIDs|TestBuildOperationRegistryRejectsDuplicateOperationIDs|TestResolveSchemaRef'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/router/mcp/openapi.go server/router/mcp/openapi_test.go
git commit -m "feat(mcp): parse generated OpenAPI operations"
```

---

## Task 3: Convert curated OpenAPI operations into MCP tool definitions

**Files:**
- Modify: `go.mod`
- Modify: `go.sum`
- Create: `server/router/mcp/catalog.go`
- Test: `server/router/mcp/catalog_test.go`

- [ ] **Step 1: Write failing catalog tests**

Create `server/router/mcp/catalog_test.go`:

```go
package mcp

import (
	"encoding/json"
	"testing"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
)

func TestCuratedOperationIDsStayMemoFocused(t *testing.T) {
	for _, operationID := range curatedOperationIDs {
		require.NotContains(t, operationID, "AuthService_")
		require.NotContains(t, operationID, "IdentityProviderService_")
		require.NotContains(t, operationID, "InstanceService_")
		require.NotContains(t, operationID, "PersonalAccessToken")
		require.NotContains(t, operationID, "Webhook")
		require.NotContains(t, operationID, "Share")
		require.NotContains(t, operationID, "BatchDelete")
		require.NotContains(t, operationID, "Transcribe")
	}
}

func TestToolNameFromOperationID(t *testing.T) {
	require.Equal(t, "memo_list_memos", toolNameFromOperationID("MemoService_ListMemos"))
	require.Equal(t, "attachment_get_attachment", toolNameFromOperationID("AttachmentService_GetAttachment"))
}

func TestBuildToolFromOperationIncludesSchemasAndMetadata(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["MemoService_ListMemos"])
	require.Equal(t, "memo_list_memos", tool.Name)
	require.Equal(t, "MemoService_ListMemos", operation.OperationID)
	require.NotEmpty(t, tool.Description)
	require.NotNil(t, tool.InputSchema)
	require.NotNil(t, tool.OutputSchema)
	require.NotNil(t, tool.Annotations)
	require.True(t, tool.Annotations.ReadOnlyHint)

	inputBytes, err := json.Marshal(tool.InputSchema)
	require.NoError(t, err)
	require.Contains(t, string(inputBytes), `"pageSize"`)

	outputBytes, err := json.Marshal(tool.OutputSchema)
	require.NoError(t, err)
	require.Contains(t, string(outputBytes), `"memos"`)
}

func TestBuildCuratedToolsHasUniqueNames(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tools, operations, err := buildCuratedTools(registry)
	require.NoError(t, err)
	require.Len(t, tools, len(curatedOperationIDs))
	require.Len(t, operations, len(curatedOperationIDs))

	names := map[string]struct{}{}
	for _, tool := range tools {
		require.IsType(t, &sdkmcp.Tool{}, tool)
		require.NotEmpty(t, tool.Name)
		require.NotContains(t, names, tool.Name)
		names[tool.Name] = struct{}{}
	}
}
```

- [ ] **Step 2: Add the official Go MCP SDK once tests import it**

```bash
go get github.com/modelcontextprotocol/go-sdk@v1.6.1
```

Expected: `go.mod` gains `github.com/modelcontextprotocol/go-sdk v1.6.1` and `go.sum` gains its checksums. This SDK is the official Go SDK and exposes `mcp.NewStreamableHTTPHandler`, `mcp.Server.AddTool`, raw JSON schemas, tool annotations, and object-shaped `CallToolResult.StructuredContent`. Do not add it with `go get -tool`.

- [ ] **Step 3: Run tests and verify they fail**

```bash
go test ./server/router/mcp/... -run 'TestCuratedOperationIDsStayMemoFocused|TestToolNameFromOperationID|TestBuildToolFromOperationIncludesSchemasAndMetadata|TestBuildCuratedToolsHasUniqueNames'
```

Expected: FAIL because `catalog.go` symbols do not exist.

- [ ] **Step 4: Implement `catalog.go`**

Create `server/router/mcp/catalog.go`:

```go
package mcp

import (
	"regexp"
	"strings"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

var curatedOperationIDs = []string{
	"MemoService_ListMemos",
	"MemoService_CreateMemo",
	"MemoService_GetMemo",
	"MemoService_UpdateMemo",
	"MemoService_DeleteMemo",
	"MemoService_ListMemoComments",
	"MemoService_CreateMemoComment",
	"MemoService_ListMemoAttachments",
	"MemoService_SetMemoAttachments",
	"MemoService_ListMemoReactions",
	"MemoService_UpsertMemoReaction",
	"MemoService_DeleteMemoReaction",
	"MemoService_ListMemoRelations",
	"MemoService_SetMemoRelations",
	"AttachmentService_ListAttachments",
	"AttachmentService_GetAttachment",
	"AttachmentService_DeleteAttachment",
}

type registeredOperation struct {
	ToolName  string
	Operation *openAPIOperation
}

var wordBoundary = regexp.MustCompile(`([a-z0-9])([A-Z])`)

func buildCuratedTools(registry map[string]*openAPIOperation) ([]*sdkmcp.Tool, map[string]*registeredOperation, error) {
	tools := make([]*sdkmcp.Tool, 0, len(curatedOperationIDs))
	operations := map[string]*registeredOperation{}
	for _, operationID := range curatedOperationIDs {
		operation, ok := registry[operationID]
		if !ok {
			return nil, nil, errors.Errorf("curated OpenAPI operation %q not found", operationID)
		}
		tool, registered := buildToolFromOperation(operation)
		if _, exists := operations[tool.Name]; exists {
			return nil, nil, errors.Errorf("duplicate MCP tool name %q", tool.Name)
		}
		tools = append(tools, tool)
		operations[tool.Name] = registered
	}
	return tools, operations, nil
}

func buildToolFromOperation(operation *openAPIOperation) (*sdkmcp.Tool, *registeredOperation) {
	name := toolNameFromOperationID(operation.OperationID)
	tool := &sdkmcp.Tool{
		Name:         name,
		Title:        titleFromToolName(name),
		Description:  operation.Description,
		InputSchema:  inputSchemaForOperation(operation),
		OutputSchema: operation.ResponseSchema,
		Annotations:  annotationsForMethod(operation.Method, name),
	}
	return tool, &registeredOperation{ToolName: name, Operation: operation}
}

func toolNameFromOperationID(operationID string) string {
	service, method, ok := strings.Cut(operationID, "_")
	if !ok {
		return strings.ToLower(operationID)
	}
	service = strings.TrimSuffix(service, "Service")
	return camelToSnake(service) + "_" + camelToSnake(method)
}

func camelToSnake(value string) string {
	return strings.ToLower(wordBoundary.ReplaceAllString(value, `${1}_${2}`))
}

func titleFromToolName(name string) string {
	parts := strings.Split(name, "_")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func inputSchemaForOperation(operation *openAPIOperation) jsonSchema {
	properties := map[string]any{}
	required := []string{}
	for _, parameter := range operation.Parameters {
		schema := cloneSchema(parameter.Schema)
		if parameter.Description != "" {
			schema["description"] = parameter.Description
		}
		properties[parameter.Name] = schema
		if parameter.Required {
			required = append(required, parameter.Name)
		}
	}
	if operation.RequestBody != nil {
		bodySchema := requestBodySchema(operation)
		properties["body"] = bodySchema
		if operation.RequestBody.Required {
			required = append(required, "body")
		}
	}
	schema := jsonSchema{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func requestBodySchema(operation *openAPIOperation) jsonSchema {
	if operation.RequestBodySchema == nil {
		return jsonSchema{"type": "object"}
	}
	return cloneSchema(operation.RequestBodySchema)
}

func cloneSchema(schema jsonSchema) jsonSchema {
	clone := jsonSchema{}
	for key, value := range schema {
		clone[key] = value
	}
	return clone
}

func annotationsForMethod(method string, name string) *sdkmcp.ToolAnnotations {
	openWorld := false
	destructive := false
	switch strings.ToUpper(method) {
	case "GET":
		return &sdkmcp.ToolAnnotations{
			Title:           titleFromToolName(name),
			ReadOnlyHint:    true,
			DestructiveHint: &destructive,
			IdempotentHint:  true,
			OpenWorldHint:   &openWorld,
		}
	case "DELETE":
		destructive = true
		return &sdkmcp.ToolAnnotations{
			Title:           titleFromToolName(name),
			ReadOnlyHint:    false,
			DestructiveHint: &destructive,
			IdempotentHint:  true,
			OpenWorldHint:   &openWorld,
		}
	default:
		return &sdkmcp.ToolAnnotations{
			Title:           titleFromToolName(name),
			ReadOnlyHint:    false,
			DestructiveHint: &destructive,
			IdempotentHint:  false,
			OpenWorldHint:   &openWorld,
		}
	}
}
```

- [ ] **Step 5: Tidy with the repository Go version**

```bash
go mod tidy -go=1.26.2
```

Expected: command succeeds. `github.com/modelcontextprotocol/go-sdk` remains in `go.mod` because `catalog_test.go` and `catalog.go` import `github.com/modelcontextprotocol/go-sdk/mcp`.

- [ ] **Step 6: Run catalog tests**

```bash
go test ./server/router/mcp/... -run 'TestCuratedOperationIDsStayMemoFocused|TestToolNameFromOperationID|TestBuildToolFromOperationIncludesSchemasAndMetadata|TestBuildCuratedToolsHasUniqueNames'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add go.mod go.sum server/router/mcp/catalog.go server/router/mcp/catalog_test.go
git commit -m "feat(mcp): derive tools from curated OpenAPI operations"
```

---

## Task 4: Implement result normalization and tool error helpers

**Files:**
- Create: `server/router/mcp/result.go`
- Test: `server/router/mcp/adapter_test.go`

- [ ] **Step 1: Write failing result tests**

Create `server/router/mcp/adapter_test.go` with the result-focused tests first:

```go
package mcp

import (
	"encoding/json"
	"testing"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
)

func TestNormalizeStructuredContentKeepsObjects(t *testing.T) {
	result := normalizeStructuredContent(map[string]any{"memos": []any{map[string]any{"name": "memos/a"}}})
	require.Equal(t, map[string]any{"memos": []any{map[string]any{"name": "memos/a"}}}, result)
}

func TestNormalizeStructuredContentWrapsArrays(t *testing.T) {
	result := normalizeStructuredContent([]any{map[string]any{"tag": "work"}})
	require.Equal(t, map[string]any{"result": []any{map[string]any{"tag": "work"}}}, result)
}

func TestNormalizeStructuredContentUsesOKForNil(t *testing.T) {
	result := normalizeStructuredContent(nil)
	require.Equal(t, map[string]any{"ok": true}, result)
}

func TestNewStructuredToolResultUsesObjectStructuredContent(t *testing.T) {
	result, err := newStructuredToolResult([]any{"one"})
	require.NoError(t, err)
	require.IsType(t, map[string]any{}, result.StructuredContent)
	require.NotEmpty(t, result.Content)
	text, ok := result.Content[0].(*sdkmcp.TextContent)
	require.True(t, ok)
	require.JSONEq(t, `{"result":["one"]}`, text.Text)
}

func TestNewToolErrorResult(t *testing.T) {
	result := newToolErrorResult("resource not found")
	require.True(t, result.IsError)
	require.NotEmpty(t, result.Content)
	text, ok := result.Content[0].(*sdkmcp.TextContent)
	require.True(t, ok)
	require.Equal(t, "resource not found", text.Text)
}

func TestDecodeJSONValue(t *testing.T) {
	value, err := decodeJSONValue([]byte(`{"ok":true}`))
	require.NoError(t, err)
	require.Equal(t, map[string]any{"ok": true}, value)

	value, err = decodeJSONValue([]byte{})
	require.NoError(t, err)
	require.Nil(t, value)

	_, err = decodeJSONValue([]byte(`{`))
	require.Error(t, err)
	require.True(t, errorsIsJSONSyntax(err), "wrapped syntax errors should remain inspectable")
}

func errorsIsJSONSyntax(err error) bool {
	var syntaxError *json.SyntaxError
	return err != nil && errors.As(err, &syntaxError)
}
```

Add these imports to the test file when the compiler asks for them:

```go
import "errors"
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
go test ./server/router/mcp/... -run 'TestNormalizeStructuredContent|TestNewStructuredToolResult|TestNewToolErrorResult|TestDecodeJSONValue'
```

Expected: FAIL because result helpers do not exist.

- [ ] **Step 3: Implement `result.go`**

Create `server/router/mcp/result.go`:

```go
package mcp

import (
	"bytes"
	"encoding/json"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

func normalizeStructuredContent(value any) map[string]any {
	switch typed := value.(type) {
	case nil:
		return map[string]any{"ok": true}
	case map[string]any:
		return typed
	case []any:
		return map[string]any{"result": typed}
	default:
		return map[string]any{"result": typed}
	}
}

func newStructuredToolResult(value any) (*sdkmcp.CallToolResult, error) {
	structured := normalizeStructuredContent(value)
	text, err := json.Marshal(structured)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal MCP structured result")
	}
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: string(text)},
		},
		StructuredContent: structured,
	}, nil
}

func newToolErrorResult(message string) *sdkmcp.CallToolResult {
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: message},
		},
		IsError: true,
	}
}

func decodeJSONValue(data []byte) (any, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, nil
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, errors.Wrap(err, "failed to decode API JSON response")
	}
	return value, nil
}
```

- [ ] **Step 4: Run result tests**

```bash
go test ./server/router/mcp/... -run 'TestNormalizeStructuredContent|TestNewStructuredToolResult|TestNewToolErrorResult|TestDecodeJSONValue'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/router/mcp/result.go server/router/mcp/adapter_test.go
git commit -m "feat(mcp): normalize structured tool results"
```

---

## Task 5: Implement the OpenAPI HTTP adapter

**Files:**
- Create: `server/router/mcp/adapter.go`
- Modify: `server/router/mcp/adapter_test.go`

- [ ] **Step 1: Add failing adapter tests**

Append to `server/router/mcp/adapter_test.go`:

```go
func TestBuildAPIRequestMapsPathQueryAndBody(t *testing.T) {
	operation := &openAPIOperation{
		Method: "PATCH",
		Path:   "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{
			{Name: "memo", In: "path", Required: true, Schema: jsonSchema{"type": "string"}},
			{Name: "updateMask", In: "query", Schema: jsonSchema{"type": "string"}},
		},
		RequestBody: &openAPIRequestBody{Required: true},
	}
	arguments := map[string]any{
		"memo":       "abc123",
		"updateMask": "content",
		"body": map[string]any{
			"memo": map[string]any{
				"name":    "memos/abc123",
				"content": "updated",
			},
		},
	}

	req, err := buildAPIRequest(context.Background(), operation, arguments, "Bearer pat")
	require.NoError(t, err)
	require.Equal(t, "PATCH", req.Method)
	require.Equal(t, "/api/v1/memos/abc123", req.URL.Path)
	require.Equal(t, "content", req.URL.Query().Get("updateMask"))
	require.Equal(t, "Bearer pat", req.Header.Get("Authorization"))

	body, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.JSONEq(t, `{"memo":{"name":"memos/abc123","content":"updated"}}`, string(body))
}

func TestBuildAPIRequestRequiresPathParameters(t *testing.T) {
	operation := &openAPIOperation{
		Method:     "GET",
		Path:       "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{{Name: "memo", In: "path", Required: true}},
	}

	_, err := buildAPIRequest(context.Background(), operation, map[string]any{}, "")
	require.ErrorContains(t, err, `missing required path parameter "memo"`)
}

func TestExecuteOperationReturnsObjectStructuredContent(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		require.Equal(t, "Bearer token", c.Request().Header.Get("Authorization"))
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/abc123"}},
		})
	})

	operation := &openAPIOperation{
		Method: "GET",
		Path:   "/api/v1/memos",
	}
	adapter := newAPIAdapter(echoServer)

	result, err := adapter.execute(context.Background(), operation, map[string]any{}, "Bearer token")
	require.NoError(t, err)
	require.False(t, result.IsError)
	require.Equal(t, map[string]any{
		"memos": []any{map[string]any{"name": "memos/abc123"}},
	}, result.StructuredContent)
}

func TestExecuteOperationConvertsAPIErrorsToToolErrors(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos/:memo", func(c *echo.Context) error {
		return c.JSON(http.StatusNotFound, map[string]any{"message": "missing memo"})
	})

	operation := &openAPIOperation{
		Method:     "GET",
		Path:       "/api/v1/memos/{memo}",
		Parameters: []openAPIParameter{{Name: "memo", In: "path", Required: true}},
	}
	adapter := newAPIAdapter(echoServer)

	result, err := adapter.execute(context.Background(), operation, map[string]any{"memo": "missing"}, "")
	require.NoError(t, err)
	require.True(t, result.IsError)
	text := result.Content[0].(*sdkmcp.TextContent)
	require.Contains(t, text.Text, "404")
	require.Contains(t, text.Text, "missing memo")
}
```

Add these imports to `server/router/mcp/adapter_test.go`:

```go
import (
	"context"
	"io"
	"net/http"

	"github.com/labstack/echo/v5"
)
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
go test ./server/router/mcp/... -run 'TestBuildAPIRequest|TestExecuteOperation'
```

Expected: FAIL because `adapter.go` symbols do not exist.

- [ ] **Step 3: Implement `adapter.go`**

Create `server/router/mcp/adapter.go`:

```go
package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"
)

type apiAdapter struct {
	echoServer *echo.Echo
}

func newAPIAdapter(echoServer *echo.Echo) *apiAdapter {
	return &apiAdapter{echoServer: echoServer}
}

func (a *apiAdapter) execute(ctx context.Context, operation *openAPIOperation, arguments map[string]any, authorization string) (*sdkmcp.CallToolResult, error) {
	req, err := buildAPIRequest(ctx, operation, arguments, authorization)
	if err != nil {
		return newToolErrorResult(err.Error()), nil
	}

	recorder := httptest.NewRecorder()
	a.echoServer.ServeHTTP(recorder, req)

	value, err := decodeJSONValue(recorder.Body.Bytes())
	if err != nil {
		return newToolErrorResult(err.Error()), nil
	}
	if recorder.Code < http.StatusOK || recorder.Code >= http.StatusMultipleChoices {
		return newToolErrorResult(apiErrorMessage(recorder.Code, value)), nil
	}
	return newStructuredToolResult(value)
}

func buildAPIRequest(ctx context.Context, operation *openAPIOperation, arguments map[string]any, authorization string) (*http.Request, error) {
	path, err := substitutePathParameters(operation, arguments)
	if err != nil {
		return nil, err
	}
	query := url.Values{}
	for _, parameter := range operation.Parameters {
		if parameter.In != "query" {
			continue
		}
		value, ok := arguments[parameter.Name]
		if !ok || value == nil {
			continue
		}
		query.Set(parameter.Name, valueToString(value))
	}
	if encoded := query.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var body io.Reader
	if operation.RequestBody != nil {
		bodyValue := arguments["body"]
		if bodyValue == nil {
			if operation.RequestBody.Required {
				return nil, errors.New(`missing required request body "body"`)
			}
			bodyValue = map[string]any{}
		}
		data, err := json.Marshal(bodyValue)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal request body")
		}
		body = bytes.NewReader(data)
	}

	req := httptest.NewRequest(operation.Method, path, body).WithContext(ctx)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	return req, nil
}

func substitutePathParameters(operation *openAPIOperation, arguments map[string]any) (string, error) {
	path := operation.Path
	for _, parameter := range operation.Parameters {
		if parameter.In != "path" {
			continue
		}
		value, ok := arguments[parameter.Name]
		if !ok || value == nil || valueToString(value) == "" {
			return "", errors.Errorf(`missing required path parameter "%s"`, parameter.Name)
		}
		encoded := url.PathEscape(valueToString(value))
		path = strings.ReplaceAll(path, "{"+parameter.Name+"}", encoded)
	}
	return path, nil
}

func valueToString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(strings.Trim(jsonNumberString(typed), `"`))
	}
}

func jsonNumberString(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
}

func apiErrorMessage(statusCode int, value any) string {
	message := ""
	if object, ok := value.(map[string]any); ok {
		for _, key := range []string{"message", "error"} {
			if raw, ok := object[key].(string); ok && raw != "" {
				message = raw
				break
			}
		}
	}
	if message == "" {
		return http.StatusText(statusCode)
	}
	return errors.Errorf("%d %s: %s", statusCode, http.StatusText(statusCode), message).Error()
}
```

- [ ] **Step 4: Run adapter tests**

```bash
go test ./server/router/mcp/... -run 'TestBuildAPIRequest|TestExecuteOperation|TestNormalizeStructuredContent|TestNewStructuredToolResult|TestNewToolErrorResult|TestDecodeJSONValue'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/router/mcp/adapter.go server/router/mcp/adapter_test.go
git commit -m "feat(mcp): execute tools through API routes"
```

---

## Task 6: Add origin checks and MCP service registration

**Files:**
- Create: `server/router/mcp/origin.go`
- Create: `server/router/mcp/service.go`
- Create: `server/router/mcp/service_test.go`
- Modify: `server/server.go`

- [ ] **Step 1: Write failing service and origin tests**

Create `server/router/mcp/service_test.go`:

```go
package mcp

import (
	"context"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
)

func TestIsAllowedMCPOrigin(t *testing.T) {
	p := &profile.Profile{InstanceURL: "https://notes.example.com"}

	require.True(t, isAllowedMCPOrigin(p, "localhost:5230", ""))
	require.True(t, isAllowedMCPOrigin(p, "localhost:5230", "http://localhost:5230"))
	require.True(t, isAllowedMCPOrigin(p, "localhost:5230", "https://notes.example.com"))
	require.False(t, isAllowedMCPOrigin(p, "localhost:5230", "https://evil.example.com"))
}

func TestNewMCPServiceRegistersCuratedTools(t *testing.T) {
	echoServer := echo.New()
	service, err := NewMCPService(context.Background(), &profile.Profile{}, echoServer, "../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	require.NotNil(t, service)
	require.Len(t, service.operationsByTool, len(curatedOperationIDs))
	require.NotNil(t, service.handler)
}
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
go test ./server/router/mcp/... -run 'TestIsAllowedMCPOrigin|TestNewMCPServiceRegistersCuratedTools'
```

Expected: FAIL because service and origin files do not exist.

- [ ] **Step 3: Implement `origin.go`**

Create `server/router/mcp/origin.go`:

```go
package mcp

import (
	"net/url"
	"strings"

	"github.com/usememos/memos/internal/profile"
)

func isAllowedMCPOrigin(profile *profile.Profile, requestHost string, origin string) bool {
	if origin == "" {
		return true
	}
	originURL, err := url.Parse(origin)
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		return false
	}
	if strings.EqualFold(originURL.Host, requestHost) {
		return true
	}
	if profile == nil || profile.InstanceURL == "" {
		return false
	}
	instanceURL, err := url.Parse(profile.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return false
	}
	return strings.EqualFold(originURL.Scheme, instanceURL.Scheme) && strings.EqualFold(originURL.Host, instanceURL.Host)
}
```

- [ ] **Step 4: Implement `service.go`**

Create `server/router/mcp/service.go`:

```go
package mcp

import (
	"bytes"
	"context"
	"net/http"

	"github.com/labstack/echo/v5"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
)

type MCPService struct {
	profile          *profile.Profile
	echoServer       *echo.Echo
	adapter          *apiAdapter
	server           *sdkmcp.Server
	handler          http.Handler
	operationsByTool map[string]*registeredOperation
}

func NewMCPService(ctx context.Context, profile *profile.Profile, echoServer *echo.Echo, openAPIPath string) (*MCPService, error) {
	spec, err := loadOpenAPISpec(openAPIPath)
	if err != nil {
		return nil, err
	}
	registry, err := buildOperationRegistry(spec)
	if err != nil {
		return nil, err
	}
	tools, operationsByTool, err := buildCuratedTools(registry)
	if err != nil {
		return nil, err
	}

	sdkServer := sdkmcp.NewServer(&sdkmcp.Implementation{Name: "memos", Version: "1.0.0"}, nil)
	service := &MCPService{
		profile:          profile,
		echoServer:       echoServer,
		adapter:          newAPIAdapter(echoServer),
		server:           sdkServer,
		operationsByTool: operationsByTool,
	}
	for _, tool := range tools {
		registered := operationsByTool[tool.Name]
		sdkServer.AddTool(tool, service.handlerForOperation(registered.Operation))
	}
	service.handler = sdkmcp.NewStreamableHTTPHandler(func(*http.Request) *sdkmcp.Server {
		return sdkServer
	}, &sdkmcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true})

	_ = ctx
	return service, nil
}

func (s *MCPService) RegisterRoutes(echoServer *echo.Echo) {
	echoServer.Any("/mcp", echo.WrapHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isAllowedMCPOrigin(s.profile, r.Host, r.Header.Get("Origin")) {
			http.Error(w, `{"message":"invalid origin"}`, http.StatusForbidden)
			return
		}
		s.handler.ServeHTTP(w, r)
	})))
}

func (s *MCPService) handlerForOperation(operation *openAPIOperation) sdkmcp.ToolHandler {
	return func(ctx context.Context, request *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
		arguments, err := callArguments(request)
		if err != nil {
			return newToolErrorResult(err.Error()), nil
		}
		authorization := ""
		if request != nil && request.Extra != nil {
			authorization = request.Extra.Header.Get("Authorization")
		}
		return s.adapter.execute(ctx, operation, arguments, authorization)
	}
}

func callArguments(request *sdkmcp.CallToolRequest) (map[string]any, error) {
	if request == nil || request.Params == nil || request.Params.Arguments == nil {
		return map[string]any{}, nil
	}
	var arguments map[string]any
	data := request.Params.Arguments
	if len(bytes.TrimSpace(data)) == 0 {
		return map[string]any{}, nil
	}
	if err := json.Unmarshal(data, &arguments); err != nil {
		return nil, errors.Wrap(err, "failed to decode MCP tool arguments")
	}
	return arguments, nil
}
```

Add this missing import in `service.go`:

```go
import "encoding/json"
```

- [ ] **Step 5: Wire the service into `server/server.go`**

Modify `server/server.go` imports to include:

```go
	"github.com/usememos/memos/server/router/mcp"
```

After successful API gateway registration, add:

```go
	mcpService, err := mcp.NewMCPService(ctx, s.Profile, echoServer, "proto/gen/openapi.yaml")
	if err != nil {
		return nil, errors.Wrap(err, "failed to register MCP service")
	}
	mcpService.RegisterRoutes(echoServer)
```

This placement keeps `/api/v1/...` routes available before the MCP adapter dispatches in-process API requests.

- [ ] **Step 6: Run service tests**

```bash
go test ./server/router/mcp/... -run 'TestIsAllowedMCPOrigin|TestNewMCPServiceRegistersCuratedTools'
```

Expected: PASS.

- [ ] **Step 7: Run server package tests**

```bash
go test ./server/...
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/router/mcp/origin.go server/router/mcp/service.go server/router/mcp/service_test.go server/server.go
git commit -m "feat(mcp): register OpenAPI-driven MCP endpoint"
```

---

## Task 7: Add MCP protocol coverage for tools/list and tools/call

**Files:**
- Modify: `server/router/mcp/service_test.go`

- [ ] **Step 1: Add protocol tests for initialize and tools/list**

Append to `server/router/mcp/service_test.go`:

```go
func TestMCPProtocolListsCuratedToolsOnly(t *testing.T) {
	echoServer := echo.New()
	service, err := NewMCPService(context.Background(), &profile.Profile{}, echoServer, "../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)

	sessionID := initializeMCP(t, echoServer)
	response := postMCP(t, echoServer, sessionID, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
	})

	result := response["result"].(map[string]any)
	tools := result["tools"].([]any)
	require.Len(t, tools, len(curatedOperationIDs))

	names := map[string]struct{}{}
	for _, rawTool := range tools {
		tool := rawTool.(map[string]any)
		name := tool["name"].(string)
		names[name] = struct{}{}
		require.Contains(t, tool, "inputSchema")
		require.Contains(t, tool, "outputSchema")
	}
	require.Contains(t, names, "memo_list_memos")
	require.Contains(t, names, "memo_create_memo")
	require.NotContains(t, names, "auth_sign_in")
	require.NotContains(t, names, "user_create_user")
}
```

Add helper functions to the same file:

```go
func initializeMCP(t *testing.T, echoServer *echo.Echo) string {
	t.Helper()
	response := postMCP(t, echoServer, "", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name":    "memos-test",
				"version": "1.0.0",
			},
		},
	})
	require.NotNil(t, response["result"])
	return ""
}

func postMCP(t *testing.T, echoServer *echo.Echo, sessionID string, payload map[string]any) map[string]any {
	t.Helper()
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	recorder := httptest.NewRecorder()
	echoServer.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var response map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}
```

Add these imports:

```go
import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
)
```

- [ ] **Step 2: Run protocol list test**

```bash
go test ./server/router/mcp/... -run TestMCPProtocolListsCuratedToolsOnly
```

Expected: PASS.

- [ ] **Step 3: Add tools/call test that proves collection results are object-shaped**

Append to `server/router/mcp/service_test.go`:

```go
func TestMCPToolCallReturnsObjectStructuredContent(t *testing.T) {
	echoServer := echo.New()
	echoServer.GET("/api/v1/memos", func(c *echo.Context) error {
		return c.JSON(http.StatusOK, map[string]any{
			"memos": []any{map[string]any{"name": "memos/abc123"}},
		})
	})

	service, err := NewMCPService(context.Background(), &profile.Profile{}, echoServer, "../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	service.RegisterRoutes(echoServer)
	_ = initializeMCP(t, echoServer)

	response := postMCP(t, echoServer, "", map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "memo_list_memos",
			"arguments": map[string]any{
				"pageSize": 1,
			},
		},
	})

	result := response["result"].(map[string]any)
	structured := result["structuredContent"].(map[string]any)
	require.Contains(t, structured, "memos")
	require.NotContains(t, structured, "result")
}
```

- [ ] **Step 4: Run tools/call test**

```bash
go test ./server/router/mcp/... -run TestMCPToolCallReturnsObjectStructuredContent
```

Expected: PASS using stateless Streamable HTTP and JSON responses.

- [ ] **Step 5: Commit**

```bash
git add server/router/mcp/service_test.go server/router/mcp/service.go
git commit -m "test(mcp): cover MCP tool discovery and calls"
```

---

## Task 8: Final verification and cleanup

**Files:**
- Review all files changed in this plan.

- [ ] **Step 1: Run package tests for MCP and related server behavior**

```bash
go test ./server/router/mcp/... ./server/router/api/v1/... ./server/...
```

Expected: PASS.

- [ ] **Step 2: Run repository Go tests if time allows**

```bash
go test ./...
```

Expected: PASS. If this fails in unrelated DB/Testcontainers packages due to local environment constraints, capture the exact failure and keep the narrower command from Step 1 as the required verification.

- [ ] **Step 3: Run tidy check**

```bash
go mod tidy -go=1.26.2
git diff -- go.mod go.sum
```

Expected: no diff after tidy, or only dependency changes already produced by Task 3.

- [ ] **Step 4: Inspect final diff**

```bash
git diff --stat
git diff -- server/router/mcp server/server.go go.mod go.sum
```

Expected: changes are limited to the MCP package, server route registration, and dependency files.

- [ ] **Step 5: Commit any final fixes**

```bash
git add server/router/mcp server/server.go go.mod go.sum
git commit -m "fix(mcp): complete OpenAPI-driven MCP verification"
```

Expected: create this commit only if Step 1 through Step 4 required additional fixes after the prior task commits. If there are no remaining changes, skip this commit.
