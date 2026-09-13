package mcp

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateToolArgumentsRejectsUnknownArguments(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"pageSize": map[string]any{"type": "integer"},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"unexpected": true})
	require.ErrorContains(t, err, `unknown argument "unexpected"`)
}

func TestValidateToolArgumentsRejectsMissingRequiredArguments(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"memo": map[string]any{"type": "string"},
		},
		"required":             []string{"memo"},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{})
	require.ErrorContains(t, err, `missing required argument "memo"`)
}

func TestValidateToolArgumentsRejectsWrongPrimitiveTypes(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"pageSize": map[string]any{"type": "integer"},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"pageSize": "ten"})
	require.ErrorContains(t, err, `argument "pageSize" must be integer`)
}

func TestValidateToolArgumentsUsesJSONSchemaValidation(t *testing.T) {
	schema := jsonSchema{
		"type": "object",
		"properties": map[string]any{
			"state": map[string]any{
				"type": "string",
				"enum": []any{"NORMAL", "ARCHIVED"},
			},
		},
		"additionalProperties": false,
	}

	err := validateToolArguments(schema, map[string]any{"state": "DELETED"})
	require.ErrorContains(t, err, "MCP tool arguments do not match input schema")
}
