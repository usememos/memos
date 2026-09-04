package mcp

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/require"
)

func TestCuratedOperationIDsStayMemoFocused(t *testing.T) {
	require.Len(t, curatedOperationIDs, 20)

	for _, operationID := range curatedOperationIDs {
		require.NotContains(t, operationID, "Admin")
		// AuthService_GetCurrentUser is the single allowed auth op (read-only
		// "whoami"); the rest of the auth/identity surface stays off MCP.
		if operationID != "AuthService_GetCurrentUser" {
			require.NotContains(t, operationID, "AuthService_")
		}
		require.NotContains(t, operationID, "UserService_")
		require.NotContains(t, operationID, "AIService_")
		require.NotContains(t, operationID, "IdentityProviderService_")
		require.NotContains(t, operationID, "InstanceService_")
		require.NotContains(t, operationID, "PersonalAccessToken")
		require.NotContains(t, operationID, "PAT")
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
	require.Equal(t, "Memo List Memos", tool.Title)
	require.Equal(t, "MemoService_ListMemos", operation.OperationID)
	require.Equal(t, "GET", operation.Method)
	require.Equal(t, "/api/v1/memos", operation.Path)
	require.Equal(t, "MemoService_ListMemos", tool.Meta["operationId"])
	require.Equal(t, "GET", tool.Meta["method"])
	require.Equal(t, "/api/v1/memos", tool.Meta["path"])
	require.NotEmpty(t, tool.Description)
	require.NotNil(t, tool.InputSchema)
	require.NotNil(t, tool.OutputSchema)
	require.NotNil(t, tool.Annotations)
	require.True(t, tool.Annotations.ReadOnlyHint)
	require.False(t, *tool.Annotations.DestructiveHint)
	require.True(t, tool.Annotations.IdempotentHint)
	require.False(t, *tool.Annotations.OpenWorldHint)

	inputBytes, err := json.Marshal(tool.InputSchema)
	require.NoError(t, err)
	require.Contains(t, string(inputBytes), `"pageSize"`)
	require.Contains(t, string(inputBytes), `"additionalProperties":false`)

	outputBytes, err := json.Marshal(tool.OutputSchema)
	require.NoError(t, err)
	require.Contains(t, string(outputBytes), `"memos"`)
}

func TestBuildToolFromOperationIncludesRequestBodySchema(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["MemoService_CreateMemo"])
	require.Equal(t, "POST", operation.Method)
	require.False(t, tool.Annotations.ReadOnlyHint)
	require.False(t, *tool.Annotations.DestructiveHint)
	require.False(t, tool.Annotations.IdempotentHint)

	input, ok := tool.InputSchema.(jsonSchema)
	require.True(t, ok)
	require.Contains(t, input["required"], "body")
	properties, ok := input["properties"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, properties, "memoId")
	require.Contains(t, properties, "body")
	body, ok := properties["body"].(jsonSchema)
	require.True(t, ok)
	require.Equal(t, "object", body["type"])
	require.Contains(t, body["properties"], "content")

	err = validateToolArguments(input, map[string]any{
		"body": map[string]any{
			"content": "hello",
		},
	})
	require.NoError(t, err)
}

func TestBuildToolFromOperationTailorsRequestBodySchemas(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tests := []struct {
		name              string
		operationID       string
		arguments         map[string]any
		omittedProperties []string
	}{
		{
			name:        "partial memo update",
			operationID: "MemoService_UpdateMemo",
			arguments: map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{"content": "updated"},
			},
			omittedProperties: []string{"name"},
		},
		{
			name:        "comment defaults state and visibility",
			operationID: "MemoService_CreateMemoComment",
			arguments: map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{"content": "comment"},
			},
		},
		{
			name:        "set attachments gets name from path",
			operationID: "MemoService_SetMemoAttachments",
			arguments: map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{"attachments": []any{}},
			},
			omittedProperties: []string{"name"},
		},
		{
			name:        "set relations gets name from path",
			operationID: "MemoService_SetMemoRelations",
			arguments: map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{"relations": []any{}},
			},
			omittedProperties: []string{"name"},
		},
		{
			name:        "upsert reaction gets name from path",
			operationID: "MemoService_UpsertMemoReaction",
			arguments: map[string]any{
				"memo": "memos/abc123",
				"body": map[string]any{
					"reaction": map[string]any{
						"reactionType": "👍",
					},
				},
			},
			omittedProperties: []string{"name"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			tool, _ := buildToolFromOperation(registry[test.operationID])
			input, ok := tool.InputSchema.(jsonSchema)
			require.True(t, ok)
			require.NoError(t, validateToolArguments(input, test.arguments))

			properties := schemaProperties(input["properties"])
			body := schemaProperties(properties["body"])
			bodyProperties := schemaProperties(body["properties"])
			for _, property := range test.omittedProperties {
				require.NotContains(t, bodyProperties, property)
			}
		})
	}
}

func TestBuildToolFromOperationRejectsEmptyMemoUpdateBody(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, _ := buildToolFromOperation(registry["MemoService_UpdateMemo"])
	input, ok := tool.InputSchema.(jsonSchema)
	require.True(t, ok)

	// An empty body carries no fields to update; reject it at the schema instead of
	// letting the gateway infer an empty field mask and fail late.
	require.Error(t, validateToolArguments(input, map[string]any{
		"memo": "memos/abc123",
		"body": map[string]any{},
	}))
	require.NoError(t, validateToolArguments(input, map[string]any{
		"memo": "memos/abc123",
		"body": map[string]any{"content": "updated"},
	}))
}

func TestRequestBodySchemaOverridePreservesRequiredByDefault(t *testing.T) {
	const operationID = "TestService_UpdateResource"
	requestBodySchemaOverrides[operationID] = requestBodySchemaOverride{
		omittedProperties: []string{"name"},
	}
	t.Cleanup(func() {
		delete(requestBodySchemaOverrides, operationID)
	})

	schema := requestBodySchema(&openAPIOperation{
		OperationID: operationID,
		RequestBodySchema: jsonSchema{
			"type":     "object",
			"required": []string{"content"},
			"properties": map[string]any{
				"name":    jsonSchema{"type": "string"},
				"content": jsonSchema{"type": "string"},
			},
		},
	})

	require.Equal(t, []string{"content"}, schema["required"])
	require.NotContains(t, schemaProperties(schema["properties"]), "name")
}

func TestBuildToolFromOperationExposesCreateAttachment(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["AttachmentService_CreateAttachment"])
	require.Equal(t, "attachment_create_attachment", tool.Name)
	require.Equal(t, "POST", operation.Method)
	require.False(t, tool.Annotations.ReadOnlyHint)
	require.False(t, *tool.Annotations.DestructiveHint)
	require.False(t, tool.Annotations.IdempotentHint)

	input, ok := tool.InputSchema.(jsonSchema)
	require.True(t, ok)
	require.Contains(t, input["required"], "body")
	properties, ok := input["properties"].(map[string]any)
	require.True(t, ok)
	// attachmentId is an optional query parameter; the file itself is the body.
	require.Contains(t, properties, "attachmentId")
	require.Contains(t, properties, "body")
	body, ok := properties["body"].(jsonSchema)
	require.True(t, ok)
	require.Contains(t, body["properties"], "filename")
	require.Contains(t, body["properties"], "content")

	err = validateToolArguments(input, map[string]any{
		"body": map[string]any{
			"filename": "screenshot.png",
			"type":     "image/png",
			"content":  "aGVsbG8=",
		},
	})
	require.NoError(t, err)
}

func TestBuildToolFromOperationExposesCurrentUser(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["AuthService_GetCurrentUser"])
	require.Equal(t, "auth_get_current_user", tool.Name)
	require.Equal(t, "GET", operation.Method)
	require.True(t, tool.Annotations.ReadOnlyHint)
}

func TestBuildToolFromOperationExposesListMemoViews(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["MemoViewService_ListMemoViews"])
	require.Equal(t, "memo_view_list_memo_views", tool.Name)
	require.Equal(t, "GET", operation.Method)
	require.True(t, tool.Annotations.ReadOnlyHint)

	input, ok := tool.InputSchema.(jsonSchema)
	require.True(t, ok)
	properties, ok := input["properties"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, properties, "user")
}

func TestBuildToolFromOperationMarksSetOperationsIdempotent(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	for _, operationID := range []string{"MemoService_SetMemoAttachments", "MemoService_SetMemoRelations"} {
		tool, operation := buildToolFromOperation(registry[operationID])
		require.Equal(t, "PATCH", operation.Method, operationID)
		// PATCH is non-idempotent by the method heuristic, but the per-operation
		// override restores the declarative "set" semantics.
		require.True(t, tool.Annotations.IdempotentHint, operationID)
		require.False(t, tool.Annotations.ReadOnlyHint, operationID)
		require.True(t, *tool.Annotations.DestructiveHint, operationID)
	}
}

func TestBuildToolFromOperationMarksUpdateMemoDestructive(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["MemoService_UpdateMemo"])
	require.Equal(t, "PATCH", operation.Method)
	require.False(t, tool.Annotations.ReadOnlyHint)
	require.True(t, *tool.Annotations.DestructiveHint)
	require.False(t, tool.Annotations.IdempotentHint)
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
		require.Equal(t, tool.Name, operations[tool.Name].ToolName)

		inputBytes, err := json.Marshal(tool.InputSchema)
		require.NoError(t, err)
		require.NotContains(t, string(inputBytes), "#/components/schemas")
		outputBytes, err := json.Marshal(tool.OutputSchema)
		require.NoError(t, err)
		require.NotContains(t, string(outputBytes), "#/components/schemas")
	}
}

func TestBuildCuratedToolsRejectsMissingOperation(t *testing.T) {
	_, _, err := buildCuratedTools(map[string]*openAPIOperation{})
	require.ErrorContains(t, err, "curated OpenAPI operation")
	require.ErrorContains(t, err, "not found")
}

func TestValidateOperationOverridesRejectsStaleKey(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)
	require.NoError(t, validateOperationOverrides(registry))

	// A renamed/removed operation must be reported instead of silently losing its
	// override.
	delete(registry, "MemoService_UpdateMemo")
	require.ErrorContains(t, validateOperationOverrides(registry), "MemoService_UpdateMemo")
}

func TestBuildCuratedToolsRejectsDuplicateToolNames(t *testing.T) {
	registry := make(map[string]*openAPIOperation, len(curatedOperationIDs))
	for _, operationID := range curatedOperationIDs {
		registry[operationID] = &openAPIOperation{
			OperationID:    operationID,
			Description:    operationID,
			Method:         "GET",
			Path:           "/api/v1/test",
			ResponseSchema: okSchema(),
		}
	}
	registry["MemoService_ListMemos"].OperationID = "MemoService_GetMemo"

	_, _, err := buildCuratedTools(registry)
	require.ErrorContains(t, err, "duplicate MCP tool name")
}

func TestBuildCuratedToolsUseStandardSchemaFormats(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tools, _, err := buildCuratedTools(registry)
	require.NoError(t, err)

	// Formats registered by JSON Schema or ajv-formats; anything else trips
	// strict clients (see https://github.com/usememos/memos/issues/6262).
	allowedFormats := map[string]struct{}{
		"date-time": {},
		"int32":     {},
		"int64":     {},
		"float":     {},
		"double":    {},
	}
	var collectFormats func(t *testing.T, tool string, path string, value any)
	collectFormats = func(t *testing.T, tool string, path string, value any) {
		switch typed := value.(type) {
		case map[string]any:
			if format, ok := typed["format"]; ok {
				formatName, isString := format.(string)
				require.True(t, isString, "%s: %s has non-string format %v", tool, path, format)
				require.Contains(t, allowedFormats, formatName, "%s: %s uses non-standard format %q", tool, path, formatName)
			}
			for key, item := range typed {
				collectFormats(t, tool, path+"/"+key, item)
			}
		case []any:
			for index, item := range typed {
				collectFormats(t, tool, path+"/"+strconv.Itoa(index), item)
			}
		default:
			// Scalars carry no nested schemas.
		}
	}

	sawBase64Content := false
	for _, tool := range tools {
		for label, schema := range map[string]any{"inputSchema": tool.InputSchema, "outputSchema": tool.OutputSchema} {
			encoded, err := json.Marshal(schema)
			require.NoError(t, err)
			var decoded any
			require.NoError(t, json.Unmarshal(encoded, &decoded))
			collectFormats(t, tool.Name, label, decoded)
			if strings.Contains(string(encoded), `"contentEncoding":"base64"`) {
				sawBase64Content = true
			}
		}
	}
	require.True(t, sawBase64Content, "expected attachment content to advertise contentEncoding base64")
}
