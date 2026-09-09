package mcp

import (
	"encoding/json"
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

func TestResolveSchemaRefRewritesNestedComponentRefs(t *testing.T) {
	spec := &openAPISpec{
		Components: openAPIComponents{
			Schemas: map[string]jsonSchema{
				"ListMemosResponse": {
					"type": "object",
					"properties": map[string]any{
						"memos": map[string]any{
							"type":  "array",
							"items": map[string]any{"$ref": "#/components/schemas/Memo"},
						},
					},
				},
				"Memo": {
					"type": "object",
					"properties": map[string]any{
						"attachment": map[string]any{"$ref": "#/components/schemas/Attachment"},
					},
				},
				"Attachment": {
					"type": "object",
					"properties": map[string]any{
						"name": map[string]any{"type": "string"},
					},
				},
			},
		},
	}

	schema, err := resolveSchemaRef(spec, jsonSchema{"$ref": "#/components/schemas/ListMemosResponse"})
	require.NoError(t, err)

	data, err := json.Marshal(schema)
	require.NoError(t, err)
	require.NotContains(t, string(data), "#/components/schemas")
	require.Contains(t, string(data), `"#/$defs/Memo"`)
	require.Contains(t, string(data), `"#/$defs/Attachment"`)
}

func TestBuildOperationRegistryResolvesRequestBodySchema(t *testing.T) {
	spec := &openAPISpec{
		Paths: map[string]map[string]*openAPIOperation{
			"/memos": {
				"post": {
					OperationID: "MemoService_CreateMemo",
					RequestBody: &openAPIRequestBody{
						Content: map[string]openAPIMediaType{
							"application/json": {Schema: jsonSchema{"$ref": "#/components/schemas/CreateMemoRequest"}},
						},
					},
					Responses: map[string]openAPIResponse{
						"200": {
							Content: map[string]openAPIMediaType{
								"application/json": {Schema: jsonSchema{"$ref": "#/components/schemas/Memo"}},
							},
						},
					},
				},
			},
		},
		Components: openAPIComponents{
			Schemas: map[string]jsonSchema{
				"CreateMemoRequest": {
					"type": "object",
					"properties": map[string]any{
						"content": map[string]any{"type": "string"},
					},
				},
				"Memo": {
					"type": "object",
				},
			},
		},
	}

	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	requestSchema := registry["MemoService_CreateMemo"].RequestBodySchema
	require.Equal(t, "object", requestSchema["type"])
	require.Contains(t, requestSchema["properties"], "content")
}

func TestBuildOperationRegistryUsesOKSchemaForEmptySuccessResponse(t *testing.T) {
	spec := &openAPISpec{
		Paths: map[string]map[string]*openAPIOperation{
			"/memos/{memo}": {
				"delete": {
					OperationID: "MemoService_DeleteMemo",
					Responses: map[string]openAPIResponse{
						"200": {
							Content: map[string]openAPIMediaType{},
						},
					},
				},
			},
		},
	}

	registry, err := buildOperationRegistry(spec)
	require.NoError(t, err)

	responseSchema := registry["MemoService_DeleteMemo"].ResponseSchema
	require.Equal(t, "object", responseSchema["type"])
	require.Contains(t, responseSchema["properties"], "ok")
}

func TestResolveSchemaRefNormalizesNonStandardFormats(t *testing.T) {
	spec := &openAPISpec{
		Components: openAPIComponents{
			Schemas: map[string]jsonSchema{
				"Attachment": {
					"type": "object",
					"properties": map[string]any{
						"state":      map[string]any{"type": "string", "format": "enum", "enum": []any{"NORMAL", "ARCHIVED"}},
						"content":    map[string]any{"type": "string", "format": "bytes"},
						"updateMask": map[string]any{"type": "string", "format": "field-mask"},
						"createTime": map[string]any{"type": "string", "format": "date-time"},
						"tags":       map[string]any{"type": "array", "items": map[string]any{"type": "string", "format": "enum"}},
					},
				},
			},
		},
	}

	schema, err := resolveSchemaRef(spec, jsonSchema{"$ref": "#/components/schemas/Attachment"})
	require.NoError(t, err)
	properties, ok := schema["properties"].(map[string]any)
	require.True(t, ok)

	state, ok := properties["state"].(map[string]any)
	require.True(t, ok)
	require.NotContains(t, state, "format")
	require.Equal(t, []any{"NORMAL", "ARCHIVED"}, state["enum"])

	content, ok := properties["content"].(map[string]any)
	require.True(t, ok)
	require.NotContains(t, content, "format")
	require.Equal(t, "base64", content["contentEncoding"])

	require.NotContains(t, properties["updateMask"].(map[string]any), "format")
	require.Equal(t, "date-time", properties["createTime"].(map[string]any)["format"])
	require.NotContains(t, properties["tags"].(map[string]any)["items"].(map[string]any), "format")
}

func TestSanitizeSchemaValueDoesNotMutateInput(t *testing.T) {
	original := jsonSchema{"type": "string", "format": "enum", "items": map[string]any{"format": "bytes"}}

	sanitized, ok := sanitizeSchemaValue(original).(map[string]any)
	require.True(t, ok)
	require.NotContains(t, sanitized, "format")
	require.Equal(t, "base64", sanitized["items"].(map[string]any)["contentEncoding"])

	require.Equal(t, "enum", original["format"])
	require.Equal(t, "bytes", original["items"].(map[string]any)["format"])
}
