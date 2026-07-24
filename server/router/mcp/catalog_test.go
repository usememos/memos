package mcp

import (
	"encoding/json"
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
						"contentId":    "memos/abc123",
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

func TestBuildToolFromOperationExposesListShortcuts(t *testing.T) {
	spec, err := loadOpenAPISpec("../../../proto/gen/openapi.yaml")
	require.NoError(t, err)
	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	tool, operation := buildToolFromOperation(registry["ShortcutService_ListShortcuts"])
	require.Equal(t, "shortcut_list_shortcuts", tool.Name)
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
